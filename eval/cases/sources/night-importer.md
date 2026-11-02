# Larkspur catalogue importer: telling a silent night apart

**Purpose:** explain how the overnight importer shows what it is doing, so that
whoever is on call can tell a stopped importer from a quiet night.
**Audience:** people who have never read the importer's code.
**Note:** Larkspur is a fictional library network, written for the Break the Wall
examples. Names, numbers and times are illustrative.

## 1. What the importer does

Every night, publishers add and correct records for the books they sell: titles,
authors, prices, cover images. The importer brings those records into the
Larkspur catalogue, so that a branch librarian who searches in the morning finds
yesterday's corrections.

It is a background process with no screen and no web page. It runs on one
machine, starts with the machine, and repeats the same round every ten minutes
until it is stopped.

A round asks each publisher's feed for records changed since the last round,
hands every new record to a worker, and the worker writes it to the catalogue.

## 2. Why silence is the hard failure

When the importer crashes, the machine restarts it and someone gets an email.
That is the easy case. The hard case is silence: the morning catalogue has no
new records, and nothing says why.

Silence has several causes that look the same from outside:

- the importer is stuck inside a call that never returns;
- someone paused it for maintenance and forgot to switch it back on;
- the publishers really sent nothing new;
- every round runs, but every record is turned away;
- the workers report success for records they never wrote.

The importer's signals exist to separate these causes. Each one answers a
different question, and the design keeps the questions apart on purpose:

1. Is the importer running at all?
2. Do its rounds reach the end?
3. What happened to each record?

A single "healthy" light would have to answer all three at once, and it would
be wrong in at least one of the cases above.

## 3. One round, step by step

A round always goes through the same steps, in this order:

1. **Wake and stamp.** The round writes the heartbeat stamp (section 4)
   before it does anything that could fail or wait.
2. **Read the switch.** It reads the pause switch (section 7). If the switch
   is off, the round records that it is paused and ends here.
3. **Fetch.** It asks each feed for records changed since the last round.
   This is the step that can hang: a feed may accept the call and never answer.
4. **Hand over.** It gives each record to a worker and moves on; it does not
   wait for the worker to finish.
5. **Close.** It writes the last-finished time (section 5) and goes back to
   sleep until the next round.

The order matters. Because the stamp comes first, a round that hangs in step 3
still left a stamp behind, and the next missing stamp is what gives it away.
Because the last-finished time comes last, it moves only when a round really
reached the end.

A round that fails in step 3 with an error, rather than hanging, ends early: it
logs the error, skips step 5, and the next round starts on time.

## 4. The heartbeat stamp

The heartbeat stamp is a single time, kept in the importer's memory and copied
to a small file on the machine's disk: the moment the latest round started.

- It is written at the start of every round, paused or not.
- It is never written anywhere else.
- Its age is the only thing it says: how long ago a round last began.

With rounds every ten minutes, a stamp younger than ten minutes is normal. A
stamp thirty minutes old means three rounds did not start, or one round has
been stuck for half an hour.

The stamp does not say whether rounds succeed. A round that fails on every
fetch still stamps on time. That is deliberate: the stamp answers question 1
and nothing else.

## 5. The last-finished time

The last-finished time is the moment the latest round reached step 5.

- It is written only at the end of a round that got through the fetch.
- A paused round does not write it.
- A round that fails in step 3 does not write it.

So the last-finished time can fall far behind the heartbeat stamp while the
importer is perfectly alive: during a pause, or while a feed keeps refusing
calls. The gap between the two times is itself information. A recent stamp and
an old last-finished time mean "running, but not getting through".

It answers question 2. It says nothing about individual records.

## 6. What happened to each record

### 6.1 The four outcomes

Every record a worker receives ends in exactly one of four outcomes, written to
the outcome log with the record's identifier:

- **Stored:** the record is in the catalogue.
- **Waiting:** the publisher announced it, but its details are not ready yet.
  The worker will try again in an hour, up to a day.
- **Rejected:** the record is malformed or breaks a catalogue rule. Trying
  again would not help, so nobody does.
- **Failed:** something went wrong that might go right next time: the
  catalogue was busy, a cover image did not download.

The log line always has the same shape, so a search for one record's
identifier returns its whole story across retries.

### 6.2 Why "the job succeeded" is not enough

The workers run inside a job system that keeps its own score: a job either
succeeded or failed. That score is about the job, not the record.

A worker that finds a rejected record finishes normally: there is nothing to
retry. The job system counts it as a success. A worker that finds a waiting
record asks for a retry, and the job system counts a failure, even though
nothing is wrong. Read alone, the job score says "all good" on a night when
every record was rejected, and "trouble" on a night when publishers were
merely slow.

This is why the outcome log exists, and why the night board reads it instead
of the job score. "The job succeeded" and "the record is in the catalogue" are
two different facts.

## 7. The pause switch

Operators can pause the importer without stopping the process: a switch in
the configuration service, read at the start of every round.

A paused importer keeps running its rounds. Each round stamps the heartbeat,
reads the switch, sees it off, records "paused" and goes back to sleep. Nothing
is fetched, nothing is handed over, and the last-finished time stays where it
was.

The heartbeat goes on during a pause on purpose. If a pause stopped the
heartbeat, the restart rule (section 8) would take a deliberate pause for a
stuck importer and restart it, again and again, for as long as the pause
lasted.

The current state of the switch is shown on the night board, so that an old
last-finished time can be read next to "paused since 01:40".

## 8. The restart rule

The machine runs a check every minute and restarts the importer when it looks
stuck. The rule reads one thing only: the age of the heartbeat stamp.

- Younger than three rounds (thirty minutes): leave it alone.
- Older: restart the importer.
- In the first five minutes after a start, leave it alone whatever the stamp
  says, so that a slow start is not mistaken for a hang.

The rule does not read the last-finished time, the pause switch or the
outcome log, and this is the point of the design. A restart can fix exactly
one problem: a round stuck inside a call that will never return. It cannot
fix a feed that refuses calls, a publisher that sent nothing, or a record that
breaks a catalogue rule. Restarting for those would only add noise, and it
would interrupt the workers that were doing fine.

The rule also leaves the catalogue and the feeds out of its check. If it asked
the catalogue whether it was healthy, a slow catalogue would cause the
importer to be restarted, which repairs nothing.

## 9. The night board

The night board is the page the on-call person opens. It shows three lights
and two numbers, one for each question:

- **Running:** green while the heartbeat stamp is younger than thirty minutes.
- **Getting through:** green while the last-finished time is younger than an
  hour, grey while the importer is paused.
- **Records:** the counts of the four outcomes since midnight, and the share
  of rejected records.
- The age of the heartbeat stamp, in minutes.
- The age of the last-finished time, in minutes.

The board reads the outcome log, not the job score (section 6.2).

It raises an alert in three cases: the running light turns red; the
getting-through light stays red for an hour while the switch is on; rejected
records pass a quarter of the night's total.

## 10. Reading the board

| Running | Getting through | Records | Most likely |
|---|---|---|---|
| red | — | — | the importer is down or stuck; the restart rule acts |
| green | grey | none | paused: check who paused it and when |
| green | red | none | a feed refuses calls, or every fetch fails |
| green | green | none | the publishers sent nothing tonight |
| green | green | mostly rejected | a publisher changed its format |
| green | green | mostly waiting | publishers are slow; nothing to do yet |
| green | green | mostly stored | a normal night |

Two rows look alike at first: "paused" and "a feed refuses calls" both leave
the running light green and nothing in the records. The getting-through light
tells them apart, grey for a pause and red for a refusing feed.

## 11. One night, as the board saw it

A night from last winter, reconstructed from the board and the outcome log.

- **00:00 to 01:40.** All three lights green. Rounds every ten minutes, a few
  hundred records stored, a handful waiting.
- **01:40.** An operator pauses the importer to move the catalogue to a new
  disk. Running stays green; getting through turns grey; no new outcomes.
- **02:30.** The switch goes back on. The next round fetches the backlog of
  fifty minutes and the last-finished time catches up.
- **03:10.** One publisher's feed accepts the call and never answers. The
  round stamped at 03:10 hangs in the fetch. No stamp at 03:20, 03:30, 03:40.
- **03:41.** The heartbeat stamp is thirty-one minutes old. The restart rule
  restarts the importer. The first round after the start stamps at 03:41,
  times out on the silent feed after two minutes, and fetches the others.
- **04:00.** Another publisher starts sending prices in a new format. Every
  record from that publisher is rejected. Running and getting through are
  green; the share of rejected records climbs past a quarter, and the board
  raises an alert.
- **04:20.** The on-call person sees the rejected records, all from one
  publisher, and calls them. The importer itself needed nothing.

Three alerts would have been one, or none, with a single "healthy" light: the
pause would have looked like a hang, the hang would have looked like a pause,
and the format change would not have shown at all.

## 12. Things this design does not catch

- **A worker that writes a wrong record.** The outcome says stored; the
  catalogue holds a mistake. Only a check of the content would see it.
- **A feed that silently drops records.** If a publisher never announces a
  record, no outcome is ever written for it.
- **A full disk.** The heartbeat file cannot be updated; the restart rule sees
  an old stamp and restarts the importer, which does not free the disk.
- **A board that is itself down.** The lights cannot show their own absence.
  The alert for a missing board comes from a different system.

These gaps are known. Each needs a signal of its own, and adding one would not
make the existing three answer more questions.

## 13. Glossary

- **Round:** one pass of the importer, every ten minutes.
- **Heartbeat stamp:** when the latest round started.
- **Last-finished time:** when the latest round reached its end.
- **Outcome:** stored, waiting, rejected or failed; one per record.
- **Job score:** the job system's own success or failure, about the job only.
- **Pause switch:** an operator's way to stop fetching without stopping the
  process.
