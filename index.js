var graphql = require('graphql')
var graphqlHttp = require('express-graphql')
var express = require('express')
var parseCommit = require('git-parse-commit')

var exec = require('child_process').exec

class Commit {
  constructor(repo, sha) {
    this.repo = repo
    this.sha = sha

    this._data = this.cmd('cat-file -p ' + this.sha).then(rawCommit => {
      return parseCommit(rawCommit)
    })
  }

  cmd (args) {
    return this.repo.cmd(args)
  }

  get message () {
    return this._data.then(d => d.title + "\n" + d.description)
  }

  get parents () {
    return this._data.then(d => d.parents.map(sha => new Commit(this.repo, sha)))
  }

  get tree () {
    return ''
  }

  get author () {
    return this._data.then(d => ({ name: d.author.name, email: d.author.email }))
  }

  get committer () {
    return this._data.then(d => ({ name: d.committer.name, email: d.committer.email }))
  }

}

class Repo {
  constructor(path) {
    this.path = path
  }

  cmd (args) {
    return new Promise((resolve, reject) => {
      exec('git ' + args, {
        cwd: this.path,
        shell: '/bin/bash'
      }, (error, stdout, stderr) => {
        if (error) {
          reject(error)
        }
        else resolve(stdout)
      })
    })
  }

  getRefs () {
    var command = "show-ref --heads | cut -d ' ' -f 2"
    return this.cmd(command).then(output => {
      return output.split("\n").filter(v => !!v).map(refName => {
        return this.cmd('rev-parse ' + refName).then(sha => {
          return {
            name: refName, commit: new Commit(this, sha)
          }
        })
      })
    })
  }
}

var userType = new graphql.GraphQLObjectType({
  name: 'User',
  fields: {
    name: { type: graphql.GraphQLString },
    email: { type: graphql.GraphQLString }
  }
})

var commitType = new graphql.GraphQLObjectType({
  name: 'Commit',
  fields: () => ({
    sha: { type: graphql.GraphQLString },
    tree: { type: graphql.GraphQLString },
    parents: { type: new graphql.GraphQLList(commitType) },
    message: { type: graphql.GraphQLString },
    author: { type: userType },
    committer: { type: userType },
  })
})

var refType = new graphql.GraphQLObjectType({
  name: 'Ref',
  fields: {
    name: {
      type: graphql.GraphQLString
    },
    commit: {
      type: commitType
    }
  }
})

var repoType = new graphql.GraphQLObjectType({
  name: 'Repo',
  fields: {
    path: { type: graphql.GraphQLString },
    refs: {
      type: new graphql.GraphQLList(refType),
      resolve: (repo, args) => {
        return repo.getRefs()
      }
    }
  }
})

var schema = new graphql.GraphQLSchema({
  query: new graphql.GraphQLObjectType({
    name: 'Query',
    fields: {
      repo: {
        type: repoType,
        args: {
          path: { type: graphql.GraphQLString }
        },
        resolve: function (_, args) {
          return new Repo(args.path)
        }
      }
    }
  })
})

express()
  .use('/graphql', graphqlHttp({schema: schema, pretty: true}))
  .listen(3000)

console.log('ready on :3000')
