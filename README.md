# Craft

Cursor plugin that connects agents to [Craft](https://www.craft.do) through Craft's official remote [Model Context Protocol](https://modelcontextprotocol.io/) server.

Search, read, create, and update documents, daily notes, tasks, and collections in a connected Craft space.

## Status

This plugin is not yet published in the Cursor Marketplace. Until it is accepted,
it will not appear in plugin search and `/add-plugin craft` will not work.

## Compatibility

Requires Cursor 3.13.0 or later.

## Test locally

1. Clone this repository and open a terminal in its root.
2. Copy the plugin into Cursor's local plugin directory:

   ```sh
   mkdir -p ~/.cursor/plugins/local/craft
   cp -R .cursor-plugin assets mcp.json ~/.cursor/plugins/local/craft/
   ```

3. Restart Cursor or run **Developer: Reload Window** from the command palette.
4. Open **Cursor Settings → Plugins**, confirm that **Craft** appears as a local
   plugin, and complete the Craft sign-in prompt.

After the plugin is accepted, it can be installed from the Cursor Marketplace
or with `/add-plugin craft`.

## MCP

```json
{
  "mcpServers": {
    "craft": {
      "type": "http",
      "url": "https://mcp.craft.do/my/mcp"
    }
  }
}
```

Auth is OAuth. Cursor prompts for Craft sign-in when the plugin connects, and you pick which space to grant access to on the authorization screen.

## Before you connect

Create an MCP connection inside the Craft app first — open **Imagine** in the
sidebar and select the space you want to connect. The endpoint will not authorize
until that connection exists.

## What agents can do

| Category | Capabilities |
| --- | --- |
| Search | Cross-document search with tag, date, and regex filters |
| Documents | Create, read, update, and delete documents |
| Daily notes & tasks | Work with daily notes and task items |
| Collections | Manage collections, including schema edits |

The hosted runtime is the source of truth for tool names and schemas.

## Notes

- Tool calls are scoped to the Craft space selected during authorization.
- The endpoint URL is the same for everyone — `https://mcp.craft.do/my/mcp`. Per-space scoping happens during OAuth approval, not in the URL.
- Because a connection is bound to one space, working across several spaces means adding one server entry per space.
- `stimmt/craft-mcp` on Packagist is an unrelated Craft **CMS** plugin.

## Links

- Craft: https://www.craft.do/
- Imagine with Craft: https://www.craft.do/imagine
- Craft MCP guide: https://www.craft.do/imagine/guide/mcp
- Connect Craft to Cursor: https://www.craft.do/imagine/guide/mcp/cursor
- MCP support article: https://support.craft.do/en/integrate/mcp
- Privacy policy: https://www.craft.do/privacy
- Terms and conditions: https://www.craft.do/terms
- Responsible disclosure: https://www.craft.do/security/responsible-disclosure
- Support: feedback@craft.do
- Server URL: https://mcp.craft.do/my/mcp

Logo is Craft's official mark, from the `craftdocs` GitHub organization.

## Validate

Run the repository checks before submitting or updating the plugin:

```sh
node scripts/validate.mjs
node scripts/validate.mjs --network
```

The network check verifies Craft's public links and the MCP server's OAuth
discovery response. Continuous integration runs the offline checks on every push
and pull request.

## License

MIT
