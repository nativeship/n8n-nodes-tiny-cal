# TidyCal n8n community node

TidyCal is an online scheduling tool for booking pages, appointment management, and paid bookings

Generated from OpenAPI 0.1 with template 1.1.0. Generated files are platform-managed and will be overwritten during regeneration.

## Authentication

This integration does not require credentials.

## Supported operations

- `GET /me` - Get account
  - Retry Contract: none
  - Pagination Contract: none
- `POST /booking-types/{bookingType}/bookings` - Create booking
  - Retry Contract: none
  - Pagination Contract: none
- `POST /booking-types` - Create booking type
  - Retry Contract: none
  - Pagination Contract: none
- `GET /booking-types/{bookingType}/timeslots` - List available timeslots
  - Retry Contract: none
  - Pagination Contract: none
- `GET /booking-types` - List booking types
  - Retry Contract: none
  - Pagination Contract: none
- `PATCH /bookings/{booking}/cancel` - Cancel booking
  - Retry Contract: none
  - Pagination Contract: none
- `GET /bookings/{booking}` - Get booking
  - Retry Contract: none
  - Pagination Contract: none
- `GET /bookings` - List bookings
  - Retry Contract: none
  - Pagination Contract: none
- `POST /contacts` - Create contact
  - Retry Contract: none
  - Pagination Contract: none
- `GET /contacts` - List contacts
  - Retry Contract: none
  - Pagination Contract: none
- `POST /teams/{team}/users` - Add user to team
  - Retry Contract: none
  - Pagination Contract: none
- `POST /teams/{team}/booking-types` - Create team booking type
  - Retry Contract: none
  - Pagination Contract: none
- `GET /teams/{team}` - Get team
  - Retry Contract: none
  - Pagination Contract: none
- `GET /teams/{team}/booking-types` - List team booking types
  - Retry Contract: none
  - Pagination Contract: none
- `GET /teams/{team}/bookings` - List team bookings
  - Retry Contract: none
  - Pagination Contract: none
- `GET /teams/{team}/users` - List team users
  - Retry Contract: none
  - Pagination Contract: none
- `GET /teams` - List teams
  - Retry Contract: none
  - Pagination Contract: none
- `DELETE /teams/{team}/users/{teamUser}` - Remove user from team
  - Retry Contract: none
  - Pagination Contract: none

## Usage

1. Install this community-node package in n8n.
2. Add the **TidyCal** node to a workflow.
3. Select a resource and operation, configure its parameters, and execute the workflow.

## Example workflow

Connect **Manual Trigger** -> **TidyCal** -> a destination node, select an operation, then run the workflow and inspect the returned items.

## Development

```sh
npm install
npm run build
npm run lint
npm run dev
```

`npm run dev` starts a local n8n development instance. Find the integration by its **TidyCal** display name.
