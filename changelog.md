## Changelog for prismic.io JavaScript development kit

### 1.0.7

#### Bugfixes
 * Fixed bug on img.getView when getting the main view, that was introduced in 1.0.6
 * Fixed bug on img.getView when getting other views, that seem never to have worked

### 1.0.6

#### Potentially breaking changes
 * None

#### Bugfixes
 * Fixed issues with the embed fragments, and `Prismic.Fragments.Embed.asHtml()`
 * Fixed issues with the "Link.file" and "Link.image" types of links (which now have their own classes)
 * Previous slugs were inaccessible for a document (therefore, it was impossible in the projects to redirect a document properly when the slug is simply obsolete); now in new fields `Prismic.Doc.slugs`

#### New features
 * Access to the repository's tags and types in the `Prismic.Api` object
 * Support for bower
 * Waiting for the [JSDoc bug](#10) to be fixed, the documentation within the code and in the README was much improved

### 1.0.5

#### Potentially breaking changes
 * `asHtml()` used to be passed the `linkResolver` function; now it will have to expect a full `ctx` object that contains the `linkResolver` function, so that all of the context can be used to build links (for instance `ctx.ref`).

#### Bugfixes
 * Calling `SearchForm.query('')` (with an empty string) used to generate an error 500, now it simply ignores the call, as should be.

#### New features
 * Full support of `asHtml()` on `StructuredText`, including embeds, lists and spans (strongs, ems, links).