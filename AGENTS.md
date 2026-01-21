## Product requirements Document
located at ./PRD.md

## Available MCP Tools:
You are able to use the Svelte MCP server, where you have access to comprehensive Svelte 5 and SvelteKit documentation. Here's how to use the available tools effectively:

### 1. list-sections
Use this FIRST to discover all available documentation sections. Returns a structured list with titles, use_cases, and paths.
When asked about Svelte or SvelteKit topics, ALWAYS use this tool at the start of the chat to find relevant sections.

### 2. get-documentation
Retrieves full documentation content for specific sections. Accepts single or multiple sections.
After calling the list-sections tool, you MUST analyze the returned documentation sections (especially the use_cases field) and then use the get-documentation tool to fetch ALL documentation sections that are relevant for the user's task.

### 3. svelte-autofixer
Analyzes Svelte code and returns issues and suggestions.
You MUST use this tool whenever writing Svelte code before sending it to the user. Keep calling it until no issues or suggestions are returned.

### 4. playground-link
Generates a Svelte Playground link with the provided code.
After completing the code, ask the user if they want a playground link. Only call this tool after user confirmation and NEVER if code was written to files in their project.


## Icons
Always use phosphor icon set with unplugin-icons and iconify-tailwind4 in this style:
<i class="icon-[ph--calendar-plus] size-6"></i>

## DB
Always use drizzle relational queries when reading and db.insert/db.update/db.delete for writing. 
Never use drizzle relational queries inside liveQuery() function.
Never use raw sql strings if there is a drizzle native way instead.
Always use timestamp({ withTimezone: true }) in schemas for timestamp columns.
Always use uuidv7 when using uuid's in schema.
Never generate migration files on your own, instead always use `npm run db:generate` for that.
Always use implicit column names when defining them in the schema.

## localization
Always use browsers locale when doing localization or date formating using Intl.*

## svelte
Always use class based svelte stores using $state, instead of getter based or stores from "svelte/store".
Always use resolve() for internal links and navigations.

## Typescript
Always use early returns when possible.
Always use string interpolation when possible.