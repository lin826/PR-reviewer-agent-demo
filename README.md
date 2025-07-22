# SWE-quality

How can we evaluate not only pass/fail but also the code quality from SWE-bench?

# Download SWE-bench leaderboard submissions from S3

1. Clone [Experiments](https://github.com/SWE-bench/experiments)
2. Run `aws sso login --profile admin-1`
3. Run `python -m analysis.download_logs evaluation/verified/20250316_augment_agent_v0 --only_logs`

If you get a `NoCredentialsError` downloading logs, you may have to apply `experiments.patch` in this repo to `analysis/download_logs.py` in the `experiments` repo.

# Development Setup

## Dependencies

We use `uv` for package management

```bash
$ uv venv
$ source .venv/bin/activate
$ uv sync
```

## Running the Application

### Backend API

Start the FastAPI backend server:

```bash
$ uvicorn backend.main:app --reload --port 8000
```

The backend also provides interactive docs at http://localhost:8000/docs

### Frontend UI

Start the Vite development server:

```bash
$ cd frontend
$ npm run dev
```

The frontend will be available at http://localhost:3000
