## Changelog for prismic.io JavaScript development kit


### 1.0.5

#### Potentially breaking changes
 * `asHtml()` used to be passed the `linkResolver` function; now it will have to expect a full `ctx` object that contains the `linkResolver` function, so that all of the context can be used to build links (for instance `ctx.ref`).

#### Bugfixes
 * Calling `SearchForm.query('')` (with an empty string) used to generate an error 500, now it simply ignores the call, as should be.

#### New features
 * Full support of `asHtml()` on `StructuredText`, including embeds, lists and spans (strongs, ems, links).