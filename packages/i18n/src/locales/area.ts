/**
 * Shape of one area file: every key must start with the area name (`common.*`, `auth.*`, ...).
 * A key placed in the wrong file, or in two files, fails `tsc`.
 */
export type AreaCatalog<Area extends string> = Readonly<Record<`${Area}.${string}`, string>>;
