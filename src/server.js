import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { buildSubgraphSchema } from '@apollo/subgraph';
import { parse } from 'graphql';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import 'dotenv/config';

async function querySupergraph(query, variables = {}) {
  const response = await fetch('http://localhost:4000', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`Supergraph query failed: ${response.statusText}`);
  }

  const result = await response.json();

  if (result.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
  }

  return result.data;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read the analytics schema (business logic layer)
const typeDefs = parse(readFileSync(join(__dirname, 'schema.graphql'), 'utf-8'));

// Resolvers for analytics and aggregation logic
// This demonstrates the type of business logic Apollo Server handles
// that Apollo Connectors cannot do declaratively
const resolvers = {
  Query: {
    eventAnalytics: async (_, { calendarId, limit = 10 }) => {
      // USE_MOCK_DATA: Return mock data for demo/testing without API key
      if (process.env.USE_MOCK_DATA === 'true') {
        const mockData = JSON.parse(
          readFileSync(join(__dirname, '../apps/luma-analytics/mock-data.json'), 'utf-8')
        );
        return mockData.eventAnalytics;
      }

      try {
        // 1. Fetch events from the Luma API via the supergraph
        const eventsQuery = `
          query GetEvents($calendarId: ID, $limit: Int) {
            events(calendarId: $calendarId, limit: $limit) {
              entries {
                apiId
                event {
                  id
                  name
                  startAt
                  geoAddressJson {
                    cityState
                    fullAddress
                  }
                }
              }
            }
          }
        `;

        const eventsData = await querySupergraph(eventsQuery, { calendarId, limit });

        if (!eventsData?.events?.entries || eventsData.events.entries.length === 0) {
          // Return empty analytics if no events found
          return {
            totalEvents: 0,
            totalAttendees: 0,
            averageAttendeesPerEvent: 0,
            checkInRate: 0,
            events: [],
          };
        }

        const events = eventsData.events.entries;

        // 2. Fetch guests for each event
        const eventSummaries = await Promise.all(
          events.map(async (entry) => {
            const guestsQuery = `
              query GetEventGuests($eventId: ID!) {
                eventGuests(eventId: $eventId) {
                  entries {
                    guest {
                      id
                      checkedInAt
                    }
                  }
                }
              }
            `;

            const guestsData = await querySupergraph(guestsQuery, {
              eventId: entry.event.id,
            });

            const guests = guestsData?.eventGuests?.entries || [];
            const attendeeCount = guests.length;
            const checkedInCount = guests.filter(
              (g) => g.guest.checkedInAt
            ).length;

            return {
              id: entry.event.id,
              name: entry.event.name,
              date: entry.event.startAt,
              attendeeCount,
              checkedInCount,
              location:
                entry.event.geoAddressJson?.cityState ||
                entry.event.geoAddressJson?.fullAddress ||
                null,
            };
          })
        );

        // 3. Aggregate and compute analytics
        const totalEvents = eventSummaries.length;
        const totalAttendees = eventSummaries.reduce(
          (sum, e) => sum + e.attendeeCount,
          0
        );
        const totalCheckedIn = eventSummaries.reduce(
          (sum, e) => sum + e.checkedInCount,
          0
        );

        return {
          totalEvents,
          totalAttendees,
          averageAttendeesPerEvent:
            totalEvents > 0 ? totalAttendees / totalEvents : 0,
          checkInRate: totalAttendees > 0 ? totalCheckedIn / totalAttendees : 0,
          events: eventSummaries,
        };
      } catch (error) {
        console.error('Error fetching event analytics:', error);
        throw new Error(`Failed to fetch event analytics: ${error.message}`);
      }
    },
  },
};

// Create Apollo Server instance for business logic using federation
const server = new ApolloServer({
  schema: buildSubgraphSchema({ typeDefs, resolvers }),
});

// Start standalone server on port 4001 (4000 is for router in rover dev)
const { url } = await startStandaloneServer(server, {
  listen: { port: 4001 },
  context: async ({ req }) => {
    return {
      headers: req.headers,
    };
  },
});

console.log(`🚀 Analytics Server ready at: ${url}`);
console.log(`📊 Provides: Event aggregations and analytics`);
