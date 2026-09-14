import { defaultSchema } from 'rehype-sanitize';

const tokenStyle = /^(?:(?:background-color|color|font-style|font-weight|text-decoration|--shiki-[\w-]+):(?:#[\da-fA-F]{3,8}|normal|italic|bold|none|underline|[1-9]00);?)+$/;
export const markdownSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    pre: [...(defaultSchema.attributes?.pre || []), 'className', 'tabIndex', ['style', tokenStyle]],
    code: [...(defaultSchema.attributes?.code || []), ['className', /^language-/]],
    span: [...(defaultSchema.attributes?.span || []), ['className', 'line'], ['style', tokenStyle]],
  },
};
