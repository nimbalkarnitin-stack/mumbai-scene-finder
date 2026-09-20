# Add live Swiggy Dineout reservations

## Build
- Extend the existing Swiggy OAuth-backed MCP client to call the documented Dineout server with the same signed-in user's session.
- Add strict builders and normalizers for `search_restaurants_dineout`, `get_restaurant_details`, and `get_available_slots`; do not persist Dineout responses.
- Match Dineout results conservatively to the current vybz venue name and location, and show nothing when the match is uncertain.
- Add a live Dineout section to eligible venue pages with restaurant details, offers, and selectable reservation date/party size for real-time slots.
- Send booking actions to Swiggy using only identifiers returned by the live tools, with clear confirmation and error states.
- Record only non-sensitive call metadata using the existing Swiggy health metrics.

## Technical details
- Keep `/food` unchanged and use `https://mcp.swiggy.com/dineout` through the existing authenticated server-only transport.
- Reuse the current OAuth token, five-day expiry behavior, bounded retry policy, and reconnect flow.
- Add focused tests for exact tool parameters, response parsing, strict venue matching, availability filtering, and no credential arguments.
- Verify tests, preview build, and signed-out venue rendering; authenticated live results require a connected user session.
