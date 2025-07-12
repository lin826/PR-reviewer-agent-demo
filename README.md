# SWE-quality

How can we evaluate not only pass/fail but also the code quality from SWE-bench?

# Download SWE-bench leaderboard submissions from S3

1. Clone [Experiments](https://github.com/SWE-bench/experiments)
2. Run `aws sso login --profile admin-1`
3. Run `python -m analysis.download_logs evaluation/verified/20250316_augment_agent_v0 --only_logs`

If you get a `NoCredentialsError` downloading logs, you may have to apply `experiments.patch` in this repo to `analysis/download_logs.py` in the `experiments` repo.

# Dependencies

We use `uv` for package management

```bash
$ uv venv
$ source .venv/bin/activate
$ uv sync
```
