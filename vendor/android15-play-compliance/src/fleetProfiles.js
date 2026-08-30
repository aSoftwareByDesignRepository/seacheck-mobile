/**
 * Per-app Android 15 / Play compliance profiles.
 *
 * stripNotificationBoot — only when the app has a *restricted* FGS type
 * (dataSync / mediaPlayback) AND does not rely on scheduled local notifications
 * surviving reboot. AudioCheck qualifies. SeaCheck must keepBoot (TaskManager +
 * maritime alarm notifications). Apps with clock-out reminders / timers keep boot.
 */
module.exports = {
  audiocheck: {
    profile: 'stripNotificationBoot',
    reason: 'dataSync FGS; sleep-timer reboot re-arm is acceptable loss',
  },
  seacheck: {
    profile: 'keepBoot',
    reason: 'TaskManager restores location FGS after reboot; maritime alarms need notification boot',
  },
  'arbeitszeitcheck-kiosk': {
    profile: 'standard',
    reason: 'no notifications module; SAW/edge/R8 only',
  },
  arbeitszeitcheck: {
    profile: 'standard',
    reason: 'local clock reminders should survive reboot; no restricted FGS',
  },
  budgetcheck: {
    profile: 'standard',
    reason: 'push-only notifications; no restricted FGS',
  },
  deskcheck: {
    profile: 'standard',
    reason: 'push-only; no restricted FGS',
  },
  'deskcheck-roomdisplay': {
    profile: 'keepBoot',
    reason: 'custom BootCompletedReceiver starts MainActivity only (not restricted FGS)',
  },
  dutycheck: {
    profile: 'standard',
    reason: 'push-only; no restricted FGS',
  },
  projectcheck: {
    profile: 'standard',
    reason: 'local timer notifications should survive reboot; no restricted FGS',
  },
  mobilitycheck: {
    profile: 'standard',
    reason: 'no notifications; SAW/edge/R8',
  },
  'mobilitycheck-terminal': {
    profile: 'standard',
    reason: 'prebuild-only; SAW/edge/R8 when android/ is generated',
  },
  ticketcheck: {
    profile: 'standard',
    reason: 'no notifications; SAW/edge/R8',
  },
  customercheck: {
    profile: 'standard',
    reason: 'prebuild-only; SAW/edge/R8 when android/ is generated',
  },
  invoicecheck: {
    profile: 'standard',
    reason: 'prebuild-only; may use notifications later — keep boot capable',
  },
  maintenancecheck: {
    profile: 'standard',
    reason: 'push-only; SAW/edge/R8',
  },
  inventorycheck: {
    profile: 'standard',
    reason: 'warehouse scanning; SAW/edge/R8',
  },
};
