/** @type {import('typedoc').TypeDocOptions} */
module.exports = {
  extends: ['../../typedoc.base.config.cjs'],
  entryPoints: ['src/main.ts'],
  out: './docs',
  readme: 'src/README.md',
};
