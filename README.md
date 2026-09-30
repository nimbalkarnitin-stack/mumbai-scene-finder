# MyMood

Build a production-ready MVP called SceneAI, an AI-powered urban discovery platform initially focused on Mumbai, India.

CORE PRODUCT:
SceneAI helps users discover things to do based on mood, budget, group type, time and location.

PRIMARY CTA:
“What’s your scene?”

SECONDARY CTA:
“Plan My Weekend”

USER FLOW:

Select mood/activity:
Party, Romantic, Live Music, Comedy, Food, Outdoors, Chill, Something New.

Select group:
Solo, Couple, Friends, Family.

Select budget:
₹500, ₹1,000, ₹2,500, ₹5,000+.

Select timing:
Tonight, Tomorrow, Saturday, Sunday, This Weekend.

Select Mumbai area.

Generate personalized recommendations.

RESULT PAGE:
Display 5–10 recommendations with:

Image

Name

Category

Area

Price

Date/time

Short description

“Why SceneAI picked this”

Booking button

Save button

Share button

ITINERARY FEATURE:
Allow users to generate a complete itinerary.
Users should be able to modify it conversationally:
“Make it cheaper”
“Replace dinner”
“Add live music”
“Keep everything near Bandra”
“Make it more romantic”

PAGES:
Home
Explore
Events
Restaurants
Cafés
Nightlife
Live Music
Comedy
Experiences
Plan My Weekend
AI Concierge
Trending
Guides
Deals
SceneAI+

ADMIN:
Create an admin dashboard for:

Venues

Events

Experiences

Offers

Categories

Users

Content

Sponsors

Affiliate links

Revenue

Analytics

DATABASE:
Design the application so it can connect to Supabase.
Use structured entities for users, preferences, venues, events, offers, interactions, affiliate links, sponsors and revenue.

RECOMMENDATION ENGINE:
Use a weighted scoring approach considering:

Preference match

Budget match

Time match

Location match

Occasion match

Freshness

Popularity

User history

Do not fabricate event dates, prices, availability or venue information.

DESIGN:
Create a premium, modern Mumbai lifestyle aesthetic.
Mobile-first.
Visual discovery should be central.
Use cards, images, chips, filters and conversational UI.
The experience should feel like a combination of an intelligent concierge and a modern city guide rather than a traditional directory.

MONETIZATION:
Support:

External booking/deep links

Affiliate tracking

Sponsored listings

SceneAI+ membership

Digital products

Clearly label sponsored content.

ANALYTICS:
Track:

Searches

Recommendation views

Saves

Shares

Booking clicks

Conversions

Revenue

User preferences

SEO:
Create SEO-friendly dynamic pages for:
Things to do in Mumbai
Mumbai events this weekend
Things to do tonight
Live music Mumbai
Comedy Mumbai
Mumbai date ideas
Mumbai nightlife
Mumbai cafés
Mumbai weekend experiences
Things to do by Mumbai neighborhood and budget.

IMPORTANT:
Build the MVP architecture so that additional cities can be added later without redesigning the core data model.

Do not build a native mobile app in this phase.
Prioritize a fast, responsive web application and the AI recommendation experience.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://mumbai-scene-finder.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/9a9f454f-a341-49b1-9de2-76970e72077e).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
