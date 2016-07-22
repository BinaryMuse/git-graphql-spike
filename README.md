```
npm install
npm start
```

To query (using HTTPie):

```
http -b POST http://localhost:3000/graphql Content-Type:application/graphql @query.graphql
```

or

```
http "http://localhost:3000/graphql?query={repo(path: \"/Users/mtilley/github/github\") { path, refs { name, commit { sha, author { name, email } } } } }"
```
