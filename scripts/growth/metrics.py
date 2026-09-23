#!/usr/bin/env python3
"""Growth sprint metrics: signups and activated signups since a start date.

Activated = tracked >= 1 job application. Uses the Firebase CLI login
(firebase auth:export + Firestore REST with the CLI's access token).

Usage: scripts/growth/metrics.py [--since 2026-09-23]
"""
import argparse
import collections
import datetime as dt
import json
import os
import subprocess
import tempfile
import urllib.request

PROJECT = "applytrack-a4197"
FIREBASE_CONFIG = os.path.expanduser("~/.config/configstore/firebase-tools.json")
FIRESTORE = f"https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents"


def access_token():
    # Refresh the CLI token as a side effect of any authenticated CLI call.
    subprocess.run(["firebase", "projects:list"], capture_output=True)
    return json.load(open(FIREBASE_CONFIG))["tokens"]["access_token"]


def export_users():
    with tempfile.TemporaryDirectory() as tmp:
        path = os.path.join(tmp, "users.json")
        subprocess.run(
            ["firebase", "auth:export", path, "--format=json", "--project", PROJECT],
            check=True, capture_output=True,
        )
        return json.load(open(path))["users"]


def list_documents(token, collection, fields):
    mask = "".join(f"&mask.fieldPaths={field}" for field in fields)
    page_token = None
    while True:
        url = f"{FIRESTORE}/{collection}?pageSize=300{mask}"
        if page_token:
            url += f"&pageToken={page_token}"
        request = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
        response = json.load(urllib.request.urlopen(request))
        yield from response.get("documents", [])
        page_token = response.get("nextPageToken")
        if not page_token:
            return


def field_value(document, name):
    value = document.get("fields", {}).get(name, {})
    if "mapValue" in value:
        return {key: next(iter(inner.values()), None) for key, inner in value["mapValue"].get("fields", {}).items()}
    return next(iter(value.values()), None) if value else None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--since", default="2026-09-23")
    args = parser.parse_args()
    since = dt.datetime.fromisoformat(args.since).replace(tzinfo=dt.timezone.utc)

    token = access_token()
    applications_per_user = collections.Counter(
        field_value(document, "userId") for document in list_documents(token, "jobApplications", ["userId"])
    )
    profiles = {
        document["name"].rsplit("/", 1)[1]: document
        for document in list_documents(token, "users", ["acquisition"])
    }

    new_users = []
    for user in export_users():
        created = dt.datetime.fromtimestamp(int(user["createdAt"]) / 1000, dt.timezone.utc)
        if created < since:
            continue
        acquisition = field_value(profiles.get(user["localId"], {}), "acquisition") or {}
        new_users.append({
            "created": created,
            "email_domain": (user.get("email") or "@none").split("@")[1],
            "applications": applications_per_user[user["localId"]],
            "source": acquisition.get("utm_source") or acquisition.get("referrer_host") or "unknown",
        })

    activated = [user for user in new_users if user["applications"] > 0]
    print(f"Since {args.since}: signups={len(new_users)} activated={len(activated)} (goal 20)")

    by_day = collections.defaultdict(lambda: [0, 0])
    for user in new_users:
        day = user["created"].date().isoformat()
        by_day[day][0] += 1
        by_day[day][1] += user["applications"] > 0
    for day in sorted(by_day):
        print(f"  {day}: signups={by_day[day][0]} activated={by_day[day][1]}")

    by_source = collections.defaultdict(lambda: [0, 0])
    for user in new_users:
        by_source[user["source"]][0] += 1
        by_source[user["source"]][1] += user["applications"] > 0
    print("By source (signups, activated):")
    for source, (signups, activated_count) in sorted(by_source.items(), key=lambda entry: -entry[1][0]):
        print(f"  {source}: {signups}, {activated_count}")

    print("Email domains:", collections.Counter(user["email_domain"] for user in new_users).most_common(10))


if __name__ == "__main__":
    main()
