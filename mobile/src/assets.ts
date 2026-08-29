/**
 * assets.ts
 * ---------
 * Every image the app uses, in one place. Screens import from here so that
 * swapping artwork is a one-line change and never touches a screen.
 */

/** Transparent product cutout — the shape every screen leans on. */
const SCOOTER_CUTOUT = require('../assets/scooter-cutout.png');

export const images = {
  /** Full scene w/ city + turbine — sits behind the auth screens' curved blob. */
  authHero: require('../assets/loginimg-v2.png'),

  /** Transparent scooter for the Home hero. */
  heroScooter: SCOOTER_CUTOUT,

  /**
   * Product shots for the vehicle carousel.
   *
   * TODO — vehicle-s1 / vehiclex1 / vehiclez1 in `mobile/assets/` are lovely
   * studio shots but their backgrounds are BAKED IN (dark gradient), so they
   * render as dark tiles on a white card. Run each through a background
   * remover, save as `vehicle-{s1,x1,z1}-cut.png`, then point these lines at
   * them. Until then all three reuse the transparent hero cutout.
   */
  vehicleS1: SCOOTER_CUTOUT,
  vehicleX1: SCOOTER_CUTOUT,
  vehicleZ1: SCOOTER_CUTOUT,

  /** Profile & KYC screen assets */
  kycHero: require('../assets/kyc-hero.jpg'),
  riderAvatar: require('../assets/rider-avatar.jpg'),
  safeLock: require('../assets/safe-lock.jpg'),
};
