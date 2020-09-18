const usersCollection = require('../db').db().collection('users')
const followsCollection = require('../db').db().collection('follows')
const ObjectID = require('mongodb').ObjectID
const User = require('./User')

let Follow = function (followedUsername, authorId) {
    this.followedUsername = followedUsername
    this.authorId = authorId
    this.errors = []
}

Follow.prototype.cleanUp = function () {
    if (typeof (this.followedUsername) != 'string') {
        this.followedUsername = ''
    }
}

Follow.prototype.validate = async function (action) {
    // followedUsername must exist in db
    let followedAccount = await usersCollection.findOne(
        {
            username: this.followedUsername
        }
    )
    if (followedAccount) {
        this.followedId = followedAccount._id
    } else {
        this.errors.push('Cannot follow a user that does not exist')
    }

    console.log(this.followedId)
    console.log(this.authorId)

    let followExists = await followsCollection.findOne(
        {
            followedId: this.followedId,
            authorId: new ObjectID(this.authorId)
        }
    )

    console.log(followExists)
    if (action == 'create') {
        if (followExists) {
            this.errors.push('User already followed.')
        }
    }
    if (action == 'delete') {
        if (!followExists) {
            this.errors.push('User not followed.')
        }
    }

    // not be able to follow onself

    if (this.followedId.equals(this.authorId)) {
        this.errors.push('You cannot follow yourself.')
    }

}

Follow.prototype.create = function () {
    return new Promise(async (resolve, reject) => {
        this.cleanUp()
        await this.validate('create')
        if (!this.errors.length) {
            await followsCollection.insertOne(
                {
                    followedId: this.followedId,
                    authorId: new ObjectID(this.authorId)
                }
            )
            resolve()
        } else {
            reject(this.errors)
        }

    })
}

Follow.prototype.delete = function () {
    return new Promise(async (resolve, reject) => {
        this.cleanUp()
        await this.validate('delete')
        if (!this.errors.length) {
            await followsCollection.deleteOne(
                {
                    followedId: this.followedId,
                    authorId: new ObjectID(this.authorId)
                }
            )
            resolve()
        } else {
            reject(this.errors)
        }

    })
}

Follow.isVisitorFollowing = async function (followedId, visitorId) {
    let followDoc = await followsCollection.findOne(
        {
            followedId: followedId,
            authorId: new ObjectID(visitorId)
        }
    )
    if (followDoc) {
        return true
    } else {
        return false
    }
}

Follow.getFollowersById = function (id) {
    return new Promise(async (resolve, reject) => {
        try {
            let followers = await followsCollection.aggregate([
                {
                    $match: {
                        followedId: id
                    }
                },
                {
                    $lookup: {
                        from: 'users',
                        localField: 'authorId',
                        foreignField: '_id',
                        as: 'userDoc'
                    }
                },
                {
                    $project: {
                        username: {
                            $arrayElemAt: ["$userDoc.username", 0]
                        },
                        email: {
                            $arrayElemAt: ["$userDoc.email", 0]
                        }
                    }

                }
            ]).toArray()

            console.log(followers)

            followers = followers.map(function (follower) {
                let user = new User(follower, true)
                return {
                    username: follower.username,
                    avatar: user.avatar
                }
            })
            resolve(followers)

        } catch {
            reject()
        }
    })
}

Follow.getFollowingById = function (id) {
    return new Promise(async (resolve, reject) => {
        try {
            let following = await followsCollection.aggregate([
                {
                    $match: {
                        authorId: id
                    }
                },
                {
                    $lookup: {
                        from: 'users',
                        localField: 'followedId',
                        foreignField: '_id',
                        as: 'userDoc'
                    }
                },
                {
                    $project: {
                        username: {
                            $arrayElemAt: ["$userDoc.username", 0]
                        },
                        email: {
                            $arrayElemAt: ["$userDoc.email", 0]
                        }
                    }

                }
            ]).toArray()

            console.log(following)

            following = following.map(function (followed) {
                let user = new User(followed, true)
                return {
                    username: followed.username,
                    avatar: user.avatar
                }
            })
            resolve(following)

        } catch {
            reject()
        }
    })
}

Follow.countFollowersById = function (id) {
    return new Promise(async (resolve, reject) => {
        let followersCount = await followsCollection.countDocuments(
            {
                followedId: id
            }
        )
        resolve(followersCount)
    })
}

Follow.countFollowedUsersById = function (id) {
    return new Promise(async (resolve, reject) => {
        let followedUsersCount = await followsCollection.countDocuments(
            {
                author: id
            }
        )
        resolve(followedUsersCount)
    })
}

module.exports = Follow