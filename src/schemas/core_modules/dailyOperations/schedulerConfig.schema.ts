import { z } from "zod";

export const RUN_TIME_MESSAGE = "Enter a valid time in HH:MM 24-hour format (e.g. 04:00)";

/**
 * Daily trip scheduler config (SchedulerConfig singleton, PATCH
 * scheduler-config/). The backend parses run_time as exactly "HH:MM"
 * (hour 0-23, minute 0-59) and rejects seconds; is_enabled is a boolean.
 * Shared by the Scheduler Config page and the inline editor on the Daily
 * Trip Assignment list.
 */
export const schedulerConfigSchema = z.object({
  run_time: z
    .string()
    .trim()
    .min(1, { message: "Auto-generation time is required", abort: true })
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, RUN_TIME_MESSAGE),
  is_enabled: z.boolean(),
});

export type SchedulerConfigValues = z.infer<typeof schedulerConfigSchema>;
