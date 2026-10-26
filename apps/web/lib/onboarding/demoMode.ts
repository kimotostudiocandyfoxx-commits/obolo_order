/**
 * The no-server demo (the review pages' demo=1 and the testers' link): input fields offer
 * 〔例で進む〕, which types their example, so an automatic run can go through every play screen
 * (story chat, 2026-10-26).
 */
let demo = false;
export const setDemoMode = (on: boolean) => {
  demo = on;
};
export const isDemoMode = () => demo;
