/**
 * assets.ts
 * ---------
 * Every image the app uses, in one place. Screens import from here so that
 * swapping artwork is a one-line change and never touches a screen.
 *
 * TODO — drop these transparent product cutouts into `mobile/assets/` and
 * point the lines below at them:
 *   scooter-cutout.png   hero scooter, no background      -> heroScooter
 *   vehicle-s1.png       RFY S1 (white),  no background   -> vehicleS1
 *   vehicle-x1.png       RFY X1 (black),  no background   -> vehicleX1
 *   vehicle-z1.png       RFY Z1 (2-tone), no background   -> vehicleZ1
 *
 * Until then they all fall back to the login hero photo.
 */

const FALLBACK = require('../assets/loginimg.png');

export const images = {
  /** Full scene w/ city + turbine — used behind the auth screens' curved blob. */
  authHero: require('../assets/loginimg.png'),

  /** Transparent scooter for the Home hero. */
  heroScooter: FALLBACK,

  /** Transparent product shots for the vehicle carousel. */
  vehicleS1: FALLBACK,
  vehicleX1: FALLBACK,
  vehicleZ1: FALLBACK,
};
