# Simple Node.js web server

A dependency-free HTTP server. Built as an example for Offlo.de managed linux runtime.
With [mise](https://mise.jdx.dev/getting-started.html) installed, run:

```sh
mise trust
mise install
mise run start
```

Open http://localhost:3000 to see `Hello from Node.js!`. Stop with Ctrl+C.

Edit `PORT` in `mise.toml` to change the port. The same file pins Node.js to
24.16.0. No `npm install` is required.
