# @loanlink-nl/cxsd

Library to generate TypeScript typings from XSD (XML Schema) files.

## Usage

```sh
# Parsing from local filesystem
cxsd path/to/file.xsd

# Parsing from stdin
cat path/to/file.xsd | cxsd

# Parsing from url
cxsd https://www.example.com/sample-xsd.xsd

# Getting help
cxsd --help
```

## Features

- Automatically download and cache to disk all imported .xsd files
- Convert XSD contents to Typescript equivalents
  - Imports from remote URLs to imports from local relative paths
  - Lists to arrays
  - Annotations to JSDoc

# License

[MIT License](https://raw.githubusercontent.com/loanlink-nl/cxsd/master/LICENSE)

Copyright (c) 2026 LoanLink

Based largely on work from BusFaster Ltd and WikiPathways.
