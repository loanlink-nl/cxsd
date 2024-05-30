# @loanlink-nl/cxsd

`cxsd` is a streaming XSD parser and XML parser generator for Node.js and [TypeScript](http://www.typescriptlang.org/).
It retrieves the specified file(s) and generates a Typescript file containing the defintions and a parser based on the widely used [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser) library.

## Usage

```sh
# Parsing from local filesystem
cxsd path/to/file.xsd

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
  - WIP: Strings, numbers and dates to matching primitive types

# License

[The MIT License](https://raw.githubusercontent.com/charto/cxsd/master/LICENSE)

Copyright (c) 2023 CapitalManagementGroup

based largely on work from BusFaster Ltd and WikiPathways
