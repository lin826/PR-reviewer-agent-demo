""" Example of using the Anthropic API to create a message batch with documents and citations."""
import random
import subprocess
import sys
import time
# import uuid
import anthropic
from anthropic.types.message_create_params import MessageCreateParamsNonStreaming
from anthropic.types.messages.batch_create_params import Request

TOTAL_TOKEN_LIMIT = 200000

THINKING_MODEL_NAME = "claude-3-7-sonnet-20250219"
THINKING_BUDGET = 1024  # Budget for thinking tokens

# Load Django from SWE-agent
from datasets import load_dataset
dataset = load_dataset('princeton-nlp/SWE-bench', split='test')
django_instances = [
    instance
    for instance in dataset
    if instance['instance_id'].startswith('django__django-')
]
ranges = list(range(len(django_instances)))
random.shuffle(ranges)
django_instances = [django_instances[random.randint(0, len(django_instances) - 1)]]

def get_show(commit: str):
    """Retrieve the commit details using git show."""
    return subprocess.run(
        ["git", "show", commit],
        capture_output=True, text=True, check=False, cwd=REPO_PATH,
    )

def get_diff(n: int, base_commit: str, cwd: str):
    """Compose the codebase by retrieving the diff of the last n commits from the base commit."""
    return subprocess.run(
        ["git", "diff", f"{base_commit}~{n}", f"{base_commit}"],
        capture_output=True, text=True, check=False, cwd=cwd, encoding='ISO-8859-1',
    )

thinking = {
    "type": "enabled",
    "budget_tokens": THINKING_BUDGET,
}
system = [{
    "type": "text",
    "text": "You are an AI assistant tasked with developing features and maintaining the codebase. Your goal is to check for violations of code changes that do not follow existing coding styles, docs, inline comments, design patterns, naming conventions, or precise reference to implementations. Also, any similar functions should be extracted to be a util. No summarize, confirm, nor compliment, just be concise without highlighting any positive outcomes and directly point out possible improvements.\n"
},
{
    "type": "text",
    "text": "",
    # By default, the cache has a 5-minute lifetime.
    # The cache is refreshed for no additional cost each time the cached content is used.
    "cache_control": {"type": "ephemeral"}
}]
messages = [{
    "role": "user",
    "content": [
        {"type": "text", "text": "Evaluate the maintainability of the code changes"},
        {
            # "title": "Document Title", # Optional, non-citable content
            # "context": "Context about the document", # Optional, non-citable content
            "type": "document",
            "source": {
                "type": "text",
                "media_type": "text/plain", 
                "data": "",
            },
            # # Enabling citations increases in input tokens due to system prompt additions and document chunking.
            # # "citations": {"enabled": True} # Optional, all or none
            # # TODO: Handle citations in the response https://docs.anthropic.com/en/docs/build-with-claude/citations#response-structure
        },
        # # Hide thinking proceess from users
        # {"type": "text", "text": "ANTHROPIC_MAGIC_STRING_TRIGGER_REDACTED_THINKING_46C9A13E193C177646C7398A98432ECCCE4C1253D5E2D82641AC0E52CC2876CB"},
    ],
}]
client = anthropic.Anthropic()

# Find as many as possible most recent commits to attached
for instance in django_instances:  # Total 850 instances
    commits = 40  # Initila number of commits to retrieve
    data = instance['patch'] + "\n\n" + instance['test_patch']

    REPO_PATH = "/Users/liniju/Documents/claude-coding-style/django"

    # # Example commit for test patch
    # PATCH_COMMIT = "2ae3044d9d4dfb8371055513e440e0384f211963"
    # result = get_show(PATCH_COMMIT)
    # if result.returncode == 0:
    #     data = result.stdout
    # else:
    #     print(f"Error executing command. Exit code: {result.returncode}")
    #     print(f"Stderr: {result.stderr}")
    #     sys.exit(1)
    # EMPTY_COMMIT = "4b825dc642cb6eb9a060e54bf8d69288fbee4904"
    # BASE_COMMIT = f"{PATCH_COMMIT}^"

    BASE_COMMIT = instance['base_commit']
    result = get_diff(commits, instance['base_commit'], REPO_PATH)
    if result.returncode == 0:
        codebase = result.stdout
    else:
        print(f"Error executing command. Exit code: {result.returncode}")
        print(f"Stderr: {result.stderr}")
        sys.exit(1)

    system[1]['text'] = codebase
    messages[0]['content'][1]['source']['data'] = data

    while True:
        # If the request is successful, break the loop
        try:
            response = client.messages.count_tokens(
                # model="claude-opus-4-20250514",
                model=THINKING_MODEL_NAME, # Extended thinking
                thinking=thinking,
                system=system,
                messages=messages,
            )
            break
        except anthropic.BadRequestError as e:
            print(instance['instance_id'], commits, e)
            # Reduce the number of commits to avoid exceeding the input token limit.
            commits //= 3
            system[1]['text'] = get_diff(commits, instance['base_commit'], REPO_PATH).stdout
            response = client.messages.count_tokens(
                model=THINKING_MODEL_NAME,
                thinking=thinking, # Do we want to further avoid thinking?
                system=system,
                messages=messages,
            )

    while response.model_dump()['input_tokens'] > TOTAL_TOKEN_LIMIT:
        # Reduce the number of commits to avoid exceeding the input token limit.
        commits //= 2
        system[1]['text'] = get_diff(commits, instance['base_commit'], REPO_PATH).stdout
        response = client.messages.count_tokens(
            model=THINKING_MODEL_NAME,
            thinking=thinking, # Do we want to further avoid thinking?
            system=system,
            messages=messages,
        )
    if commits < 5:
        print(instance['instance_id'], commits, response.model_dump()['input_tokens'])

# [Note] 'claude-2.0' does not support cache_control and batching.
message_batch = client.messages.batches.create(
    requests=[
        Request(
            # custom_id=str(uuid.uuid4()),
            custom_id="my-first-request",
            params=MessageCreateParamsNonStreaming(
                model=THINKING_MODEL_NAME,
                max_tokens = THINKING_BUDGET + 64, # `max_tokens` must be greater than `thinking.budget_tokens`
                thinking=thinking,
                system=system,
                messages=messages,
                # betas=[
                #     # Locations of Developer Guide
                #     "files-api-2025-04-14", # Files API
                #     "code-execution-2025-05-22", # Code execution tool
                #     "interleaved-thinking-2025-05-14", # Building with extended thinking
                # ],
            ),
        ),
    ]
)

print(message_batch)
# No cache_control: MessageBatch(id='msgbatch_01MhV6ghZZ1urrLqiJfFsCmm', archived_at=None, cancel_initiated_at=None, created_at=datetime.datetime(2025, 6, 30, 22, 5, 35, 34407, tzinfo=datetime.timezone.utc), ended_at=None, expires_at=datetime.datetime(2025, 7, 1, 22, 5, 35, 34407, tzinfo=datetime.timezone.utc), processing_status='in_progress', request_counts=MessageBatchRequestCounts(canceled=0, errored=0, expired=0, processing=2, succeeded=0), results_url=None, type='message_batch')
# MessageBatch(id='msgbatch_01TxuvXkGrxDvq19MtHDbZg2', archived_at=None, cancel_initiated_at=None, created_at=datetime.datetime(2025, 6, 30, 22, 17, 41, 600981, tzinfo=datetime.timezone.utc), ended_at=None, expires_at=datetime.datetime(2025, 7, 1, 22, 17, 41, 600981, tzinfo=datetime.timezone.utc), processing_status='in_progress', request_counts=MessageBatchRequestCounts(canceled=0, errored=0, expired=0, processing=2, succeeded=0), results_url=None, type='message_batch')

# TODO: Verify that the total batch request size doesn’t exceed 256 MB. If the request size is too large, you may get a 413 request_too_large error.

wait_time = 10
MESSAGE_BATCH_ID = message_batch.id
message_batch = None
while True:
    time.sleep(wait_time)  # Wait a few seconds to ensure the batch is created
    message_batch = client.messages.batches.retrieve(
        MESSAGE_BATCH_ID
    )
    if message_batch.processing_status == "ended":
        break
    print(f"Batch {MESSAGE_BATCH_ID} is still processing...")
    wait_time += 10

# Stream results file in memory-efficient chunks, processing one at a time
for result in client.messages.batches.results(
    MESSAGE_BATCH_ID,
):
    match result.result.type:
        case "succeeded":
            # [Note] Use meaningful custom_id values, order is not guaranteed.
            print(result.result)
            print('\n' + '-' * 80 + '\n')
            for block in result.result.message.content:
                print(block.text)
        case "errored":
                print(result.result.error)
        case "expired":
            print(f"Request expired {result.custom_id}")
        case "canceled":
            print(f"Request canceled {result.custom_id}")
        case _:
            print(f"Unknown result type {result.result.type} for request {result.custom_id}")
    print()
