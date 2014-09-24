### 1.0.18 (2014-09-22)

**Breaking change**: The content in StructuredText is now escaped. This was a bug that had to be fixed, but if you relied on it to include custom HTML it will no longer work. You can use a custom html serializer to get the behavior you need.

Bugfixes:

  - The content in StructuredText is now escaped.
  - \#64 Fixed grouping lists

### 1.0.17 (2014-09-19)

Features:

  - Custom HTML serializer for StructuredText.asHtml()
  - Custom user agent for NodeJS

### 1.0.14 (2014-09-03)

Features:

  - Add the "block-img" class to <p> tags of images

### 1.0.13 (2014-09-02)

Features:

  - Labels for blocks and spans
  - Add support for h4 to h6
