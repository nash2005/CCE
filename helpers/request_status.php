<?php
/**
 * Claiming-window status helpers.
 *
 * When the staff sets a claiming schedule, the row is stored with the status
 * "Scheduled for Claiming". That stored status is only the *source* value:
 * a scheduled request must keep the status "Pending" for everyone until the
 * FIRST DAY of the claiming span, and only then becomes "Ready to Claim".
 *
 * Every API that returns a request to the UI must therefore pass the row
 * through applyClaimWindowStatus() so the displayed status follows the
 * claiming window instead of the raw column value.
 */

/**
 * Where we are relative to the claiming window.
 *
 * Returns:
 *   ''       -> no claiming schedule has been set
 *   'before' -> the window has not started yet (today is before the start date)
 *   'open'   -> today is inside the window (or on/after the start date when no
 *               end date is recorded)
 *   'ended'  -> today is after the end date of the window
 *
 * @param string $claimStart tbl_requests.claim_schedule_start (Y-m-d)
 * @param string $claimEnd   tbl_requests.claim_schedule_end (Y-m-d)
 * @return string
 */
function getClaimWindowState($claimStart, $claimEnd = '')
{
    $start = trim((string)$claimStart);
    if ($start === '') {
        return '';
    }

    $today = date('Y-m-d');
    if ($today < $start) {
        return 'before';
    }

    $end = trim((string)$claimEnd);
    if ($end !== '' && $today > $end) {
        return 'ended';
    }

    return 'open';
}

/**
 * The status the UI should display for a request.
 *
 * "Ready to Claim" is only shown once the claiming window has STARTED.
 * Everything before that stays "Pending":
 *   - "Ready to Claim" (finalized by the staff, schedule not set yet) -> Pending
 *   - "Scheduled for Claiming" with the window not started yet        -> Pending
 *   - "Scheduled for Claiming" on/after the first day of the span     -> Ready to Claim
 * Any other status is returned untouched.
 *
 * @param string $status     the status stored in tbl_requests
 * @param string $claimStart tbl_requests.claim_schedule_start (Y-m-d)
 * @return string
 */
function getEffectiveRequestStatus($status, $claimStart = '')
{
    $status = trim((string)$status);

    // Both pre-release states wait for the claiming window
    $isReady      = strcasecmp($status, 'Ready to Claim') === 0;
    $isScheduled  = strcasecmp($status, 'Scheduled for Claiming') === 0;
    if (!$isReady && !$isScheduled) {
        return $status;
    }

    // Finalized but no claiming schedule set yet -> still pending
    if (trim((string)$claimStart) === '') {
        return 'Pending';
    }

    return getClaimWindowState($claimStart) === 'before' ? 'Pending' : 'Ready to Claim';
}

/**
 * Overlay the claiming-window rules on a request row returned by a query.
 *
 * Adds:
 *   raw_status         - the status stored in tbl_requests
 *   claim_window_state - '', 'before', 'open' or 'ended'
 * and rewrites `status` to the effective (displayed) status.
 *
 * @param array $request a tbl_requests row
 * @return array the row with the claiming-window fields applied
 */
function applyClaimWindowStatus(array $request)
{
    $rawStatus  = isset($request['status']) ? $request['status'] : '';
    $claimStart = isset($request['claim_schedule_start']) ? $request['claim_schedule_start'] : '';
    $claimEnd   = isset($request['claim_schedule_end']) ? $request['claim_schedule_end'] : '';

    $request['raw_status'] = $rawStatus;
    $request['claim_window_state'] = getClaimWindowState($claimStart, $claimEnd);
    $request['status'] = getEffectiveRequestStatus($rawStatus, $claimStart);

    return $request;
}
?>