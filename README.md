# Todo List

A container-ready todo list webapp built with React, Express, and SQLite.

## Local development

```sh
npm install
npm run dev
```

The frontend runs at http://localhost:5173 and proxies API calls to the backend on port 3000.

## Production

```sh
npm run build
npm start
```

The server listens on `PORT` and stores data in `DB_PATH`, defaulting to `data/todos.sqlite`.

## Docker

```sh
docker build -t todo-list .
docker run --rm -p 3000:3000 -v todo-data:/app/data todo-list
```

## GitHub Actions deployment

Pushes to `main` run tests, build the Docker image, publish it to GitHub Container Registry, and deploy it to a VPS over SSH.

Add these repository secrets in GitHub:

- `SSH_KEY`: private SSH key for the deploy user
- `VPS_HOST`: VPS hostname or IP address
- `VPS_PORT`: SSH port
- `VPS_USER`: SSH username

The VPS must have Docker and Docker Compose v2 installed, and `VPS_USER` must be able to run Docker commands without an interactive sudo prompt.

The deployed app listens at:

```text
http://<VPS_HOST>:8081
```

SQLite data is stored in the `todo-list-data` Docker volume on the VPS.
