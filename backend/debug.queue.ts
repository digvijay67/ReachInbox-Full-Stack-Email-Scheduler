// import { emailQueue } from "./src/queue/email.queue";

// async function check() {
//   console.log(
//     await emailQueue.getJobCounts(
//       "waiting",
//       "active",
//       "delayed",
//       "completed",
//       "failed",
//       "paused"
//     )
//   );

//   for (const id of [24, 25, 26, 27, 28]) {
//     const job = await emailQueue.getJob(`email-${id}`);

//     if (!job) {
//       console.log(`email-${id}: JOB NOT FOUND`);
//       continue;
//     }

//     console.log(
//       `email-${id}:`,
//       await job.getState(),
//       "delay:",
//       job.delay,
//       "timestamp:",
//       new Date(job.timestamp).toISOString()
//     );
//   }

//   await emailQueue.close();
// }

// check();