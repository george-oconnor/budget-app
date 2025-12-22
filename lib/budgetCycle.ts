/**
 * Calculate the start date of the current budget cycle
 */
export function getCycleStartDate(
  cycleType: "first_working_day" | "last_working_day" | "specific_date" | "last_friday" = "first_working_day",
  cycleDay?: number
): Date {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDate();

  let cycleStart: Date;

  switch (cycleType) {
    case "first_working_day": {
      // Start from first working day of current month
      cycleStart = new Date(Date.UTC(year, month, 1, 0, 0, 0));
      // Move to first working day (skip weekends)
      while (cycleStart.getUTCDay() === 0 || cycleStart.getUTCDay() === 6) {
        cycleStart.setUTCDate(cycleStart.getUTCDate() + 1);
      }
      // If first working day has passed this month, start from first working day of next month
      if (cycleStart < now) {
        cycleStart = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0));
        while (cycleStart.getUTCDay() === 0 || cycleStart.getUTCDay() === 6) {
          cycleStart.setUTCDate(cycleStart.getUTCDate() + 1);
        }
        // Go back to previous month's first working day
        cycleStart.setUTCMonth(cycleStart.getUTCMonth() - 1);
      }
      break;
    }

    case "last_working_day": {
      // Start from last working day of previous month
      cycleStart = new Date(Date.UTC(year, month, 0, 0, 0, 0)); // Last day of previous month
      while (cycleStart.getUTCDay() === 0 || cycleStart.getUTCDay() === 6) {
        cycleStart.setUTCDate(cycleStart.getUTCDate() - 1);
      }
      break;
    }

    case "specific_date": {
      // Start from specific day of previous month
      const cycleDay_ = cycleDay ?? 1;
      cycleStart = new Date(Date.UTC(year, month - 1, cycleDay_, 0, 0, 0));
      break;
    }

    case "last_friday": {
      // Start from last Friday of previous month
      const lastDay = new Date(Date.UTC(year, month, 0));
      cycleStart = new Date(lastDay);
      // Go back to last Friday (5 = Friday)
      while (cycleStart.getUTCDay() !== 5) {
        cycleStart.setUTCDate(cycleStart.getUTCDate() - 1);
      }
      break;
    }

    default:
      cycleStart = new Date(Date.UTC(year, month, 1, 0, 0, 0));
  }

  return cycleStart;
}
