# Workflow Escalation – How It Works

**Audience:** Internal (non-technical) understanding + implementation reference.

---

## 1. In Simple Terms (Non-Technical)

### What is escalation?

When a **maintenance approval** must go through several people in order (e.g. Supervisor → Manager → Head), each person has a **maximum number of days** to approve. If that person does **not** approve within that time, the system **automatically**:

1. **Escalates** the request to the **next person** in the sequence (e.g. from Supervisor to Manager).
2. **Sends a notification** (email + app) to that next person.
3. Keeps the **original approver** still in the loop – **both** must approve for the workflow to move on.

So: “Step 1 didn’t approve in time → we alert Step 2, but Step 1 still has to approve as well.”

### Who decides “maximum days” and “who is next”?

- **Maximum days** for each step = **Escalation days** (`esc_no_days`) set on that **workflow step** in the system (in **Workflow Steps** / `tblWFSteps`).
- **Who is next** = the **next step** in the **workflow sequence** for that asset type (in **Workflow Sequences** / `tblWFATSeqs`).
- **Who gets the escalation notification** = only the **job roles** linked to that next step (in **Workflow Job Roles** / `tblWFJobRole`).

So: configuration in **Workflow Steps**, **Sequences**, and **Job Roles** drives when we escalate and to whom.

---

## 2. Step-by-Step (What the System Does)

| Step | What happens | In plain language |
|------|----------------|--------------------|
| **1** | A **scheduled job** runs every day (e.g. 9:00 AM). | The system checks once per day if any approval is “overdue”. |
| **2** | The system finds all **current approval steps** that are still **pending** (status “Awaiting Approval” / `AP`) and where the **workflow** is still **in progress** (not completed or rejected). | It only looks at steps that are actually waiting for someone to approve. |
| **3** | For each such step, it gets the **deadline** for that step: | So we know “by when” this person had to approve. |
| | • If the step has **Escalation days** set → **Deadline = date this step became “Awaiting Approval” + Escalation days**. | Example: step became AP on 1 Mar, escalation days = 3 → deadline 4 Mar. |
| | • If **Escalation days** is not set → **Deadline = Due date of the maintenance − lead time** (old behaviour). | Fallback so old setups still work. |
| **4** | It checks: **Is today’s date after the deadline?** | If yes → this step is **overdue** and we will escalate. |
| **5** | It also checks: **Has this workflow already been escalated** (e.g. note “ESCALATED on …”)? | We don’t escalate the same workflow again and again. |
| **6** | For each **overdue** step it finds the **next step** in the sequence (same workflow, next sequence number, status “Inactive”). | “Next person” = next step in the workflow sequence. |
| **7** | It activates **all** approvers for that **next** step (sets their status to “Awaiting Approval”). | Those people are exactly the job roles configured for that next step (from Workflow Job Roles). |
| **8** | It sends **email** and **app notification** to each of those next approvers. | Only the people in the next step (per configuration) get the alert. |
| **9** | The **current** (overdue) approver **stays** “Awaiting Approval” – the system does **not** remove them. | So both current and next approver must approve. |

---

## 3. What Is Checked (Conditions)

- **Who is “current approver”?**  
  Rows in the workflow detail table where **status = ‘AP’** (Awaiting Approval) and the **header** is **‘IN’ or ‘IP’** (In Progress).

- **When is a step “overdue”?**  
  - **Preferred:** The step has **esc_no_days** in **tblWFSteps** (via **tblWFATSeqs** using asset type + sequence).  
    Overdue if: **today > (date step became AP + esc_no_days)**.  
  - **Fallback:** If **esc_no_days** is not set: **today > (maintenance due date − lead time)**.

- **Who is “next approver”?**  
  All detail rows for the **same workflow** with the **next sequence number** and status **‘IN’**.  
  These rows were created from **tblWFATSeqs** + **tblWFJobRole**, so they are exactly the job roles configured for the next step.

- **Do we escalate?**  
  Only if there is **at least one** such “next” row **and** the workflow does **not** already have an escalation note (so we don’t escalate twice for the same event).

---

## 4. What Is Changed in the System

| What | Before | After |
|------|--------|--------|
| **Current approver row(s)** | Status **AP** | **Unchanged** (still AP) |
| **Next step row(s)** | Status **IN** | Status set to **AP**; a note is added: “ESCALATED on &lt;timestamp&gt; - Step deadline exceeded (esc_no_days)” |
| **Notifications** | – | Email + push sent to **each** user in the next step (only job roles from **tblWFJobRole** for that step) |

No other tables are updated by the escalation process (e.g. header status stays IN/IP until someone approves or rejects).

---

## 5. Example (End-to-End)

### Setup (configuration)

- **Asset type:** “Pump”.
- **Workflow sequence (tblWFATSeqs):**  
  - Step 1 (seq 1): “Supervisor Approval” (e.g. `wf_steps_id = WFS001`).  
  - Step 2 (seq 2): “Manager Approval” (e.g. `wf_steps_id = WFS002`).
- **Workflow steps (tblWFSteps):**  
  - “Supervisor Approval”: **Escalation days = 3**.  
  - “Manager Approval”: **Escalation days = 5**.
- **Workflow job roles (tblWFJobRole):**  
  - Supervisor step → Job role “Supervisor”.  
  - Manager step → Job role “Manager”.

### What happens

1. A **maintenance request** is created for a Pump. The workflow starts; **Supervisor** is “Awaiting Approval” (status AP) from **1 March**.
2. **Deadline for Supervisor step** = 1 Mar + 3 days = **4 March**.
3. **5 March** – the daily job runs:
   - It finds: current step = Supervisor (AP), deadline 4 Mar, today 5 Mar → **overdue**.
   - It finds next step = Manager (sequence 2), status IN.
   - It sets **Manager** to “Awaiting Approval” (AP) and adds the escalation note.
   - It sends **email and app notification** to the **Manager** (only that job role).
4. **Result:**  
   - **Supervisor** still has to approve (still AP).  
   - **Manager** also has to approve (now AP).  
   - Both must approve for the workflow to proceed.

### Same example in “condition / check” terms

- **Checked:** Current step = Supervisor (AP), workflow in progress, esc_no_days = 3, step became AP on 1 Mar → deadline 4 Mar; today 5 Mar → overdue. No prior escalation note → escalate.
- **Changed:** Manager’s row: IN → AP, note added. Email + push to Manager role only.

---

## 6. Where This Runs

- **Automatically:** A **cron job** runs once per day (e.g. 9:00 AM) and calls the escalation process for the configured organisation(s).
- **Manually:** An admin can trigger the same process via the **“Trigger workflow escalation”** action (e.g. from the dashboard or API).

The **logic** (what is checked, what is changed, and the conditions above) is the same in both cases.

---

## 7. Testing the auto-escalation

### Prerequisites

1. **Database:** Run the migration that adds `esc_no_days` to `tblWFSteps`:
   ```bash
   cd AssetLifecycleBackend
   node migrations/add-esc-no-days-to-tblWFSteps.js
   ```
2. **Configuration:** Set **Escalation days** (`esc_no_days`) on at least one workflow step (e.g. 1 or 2 days for quick testing). Use the Workflow Steps UI/API (create or update step with `esc_no_days`).
3. **Test data:** Have at least one workflow where:
   - The **current** approval step is in status **AP** (Awaiting Approval),
   - The **header** is **IN** or **IP**,
   - The step’s **deadline** has passed: either **(date step became AP + esc_no_days) &lt; today**, or (if `esc_no_days` is null) **due date − lead time** is in the past,
   - The workflow has **not** been escalated before (no “[ESCALATED on” note on any detail row).

### Option A: Test script (no API auth)

From the backend folder:

```bash
node scripts/test-workflow-escalation.js [orgId]
```

Example:

```bash
node scripts/test-workflow-escalation.js ORG001
```

The script will:

1. List all workflow steps and their `esc_no_days` (so you can confirm data).
2. List any **overdue** workflows (what would be escalated).
3. Run the **escalation process** (same logic as the daily cron).
4. Print a summary: total overdue, escalated count, no next approver, errors, and details.

If you see “No overdue workflows”, fix configuration or test data (step in AP, deadline in the past, `esc_no_days` set if you want step-based deadline).

### Option B: API (with auth)

1. **Check status and `esc_no_days`:**
   - `GET /api/workflow-escalation/status?orgId=ORG001`  
   - Response includes `stepsWithEscDays`, `overdueCount`, `willEscalate`, and `overdueSummary`.
2. **List overdue only:**
   - `GET /api/workflow-escalation/overdue?orgId=ORG001`
3. **Run escalation manually:**
   - `POST /api/workflow-escalation/process`  
   - Body: `{ "orgId": "ORG001" }` (or omit to use default).  
   - Same effect as the daily cron run.

### Verifying escalation happened

- **Overdue list** should no longer include that workflow for the same step (it was escalated).
- **Workflow detail:** The **next** step’s rows should now be **AP** and have a note like “ESCALATED on &lt;date&gt; - Step deadline exceeded”.
- **Notifications:** Next approvers (job roles from `tblWFJobRole` for that step) should receive email and in-app notification.
- Running the script or process again immediately should not escalate the same step again (escalation note is present).
