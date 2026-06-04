export const spring = { type: "spring", stiffness: 420, damping: 34, mass: 0.7 };
export const springSoft = { type: "spring", stiffness: 240, damping: 28 };

export const pop = {
  initial: { opacity: 0, scale: 0.96, y: 6 },
  animate: { opacity: 1, scale: 1, y: 0, transition: spring },
  exit: { opacity: 0, scale: 0.97, y: -4, transition: { duration: 0.13 } },
};

export const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: (i = 0) => ({ opacity: 1, y: 0, transition: { ...springSoft, delay: i * 0.05 } }),
};
