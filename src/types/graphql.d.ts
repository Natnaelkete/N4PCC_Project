declare module 'graphql-tag' {
  import { DocumentNode } from 'graphql';
  export function gql(literals: TemplateStringsArray, ...placeholders: any[]): DocumentNode;
}



