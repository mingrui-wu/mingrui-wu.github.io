# Lessons

- Before remote Git operations, check both Git's own proxy configuration and the
  process proxy environment. A stale Git setting can override the current proxy.
  Prefer the proxy supplied for the active session, using a per-command override
  rather than changing the machine's global configuration.
