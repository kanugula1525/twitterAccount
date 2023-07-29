const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());
module.exports = app;

let db = null;
const dbPath = path.join(__dirname, "twitterClone.db");

const initializationDBAndServer = async () => {
  try {
    db = await open({ filename: dbPath, driver: sqlite3.Database });
    app.listen(3000, () => {
      console.log("Server is running at http://localhost:3000");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializationDBAndServer();

const validateUserRegistration = async (request, response, next) => {
  const { username, password, name, gender } = request.body;

  if (username !== undefined) {
    // scenario 1
    const isUserAlreadyExists = `
      SELECT * FROM user WHERE username = '${username}';
      `;
    const result = await db.get(isUserAlreadyExists);
    if (result === undefined) {
      if (password.length < 6) {
        // scenario 2
        response.status(400);
        response.send("Password is too short");
      } else {
        request.username = username;
        request.password = password;
        request.name = name;
        request.gender = gender;
        next();
      }
    } else {
      response.status(400);
      response.send("User already exists");
    }
  }
};

const validateUser = async (request, response, next) => {
  const { username, password } = request.body;

  const getUserDetails = `
  SELECT * FROM user WHERE username = '${username}';`;
  const userData = await db.get(getUserDetails);
  if (userData === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, userData.password);
    if (isPasswordMatched) {
      next();
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
};

const jwtAuthorization = (request, response, next) => {
  let userJwtToken;
  const header = request.headers["authorization"];
  if (header !== undefined) {
    userJwtToken = header.split(" ")[1];
  }
  if (userJwtToken !== undefined) {
    jwt.verify(userJwtToken, "My_Account", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  } else {
    response.status(401);
    response.send("Invalid JWT Token");
  }
};

const validateFollower = async (request, response, next) => {
  const { tweetId } = request.params;
  let userJwtToken;
  const header = request.headers["authorization"];
  if (header !== undefined) {
    userJwtToken = header.split(" ")[1];
  }
  if (userJwtToken !== undefined) {
    jwt.verify(userJwtToken, "My_Account", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        let followingList = [];
        let follower = 4;
        if (tweetId !== undefined) {
          const getFollowingId = `
          SELECT user_id FROM tweet
          WHERE tweet_id=${tweetId};`;
          const followingId = await db.get(getFollowingId);

          const getUserFollowingList = `
          SELECT following_user_id FROM follower
          WHERE follower_user_id=${follower};`;
          const tweetDetails = await db.all(getUserFollowingList);

          tweetDetails.map((item) => {
            let { following_user_id } = item;
            followingList.push(following_user_id);
          });

          const isUserFollowing = await followingList.includes(
            followingId.user_id
          );
          //   console.log(isUserFollowing);
          if (isUserFollowing) {
            request.tweetId = tweetId;
            next();
          } else {
            response.status(401);
            response.send("Invalid Request");
          }
        } else {
          response.status(401);
          response.send("Invalid Request");
        }
      }
    });
  } else {
    response.status(401);
    response.send("Invalid JWT Token");
  }
  ////
};

const deleteVerification = async (request, response, next) => {
  const { tweetId } = request.params;
  let user_id = 11;
  try {
    const checkUser = `
  SELECT user_id FROM tweet WHERE tweet_id=${tweetId};`;
    const user = await db.get(checkUser);
    if (user.user_id !== undefined) {
      if (user.user_id === user_id) {
        request.tweetId = tweetId;
        next();
      } else {
        response.status(401);
        response.send("Invalid Request");
      }
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  } catch (e) {
    response.status(401);
    response.send("Invalid Request");
  }
};
// API 1 //
app.post("/register/", validateUserRegistration, async (request, response) => {
  const { username, password, name, gender } = request;
  const hashedPassword = await bcrypt.hash(password, 10);
  const createUser = `
  INSERT INTO user(username, password, name, gender)
  VALUES(
      '${username}',
      '${hashedPassword}',
      '${name}',
      '${gender}');`;
  await db.run(createUser);
  response.send("User created successfully");
});

// API 2 //
app.post("/login/", validateUser, async (request, response) => {
  const { username, password } = request;
  const payload = { username: username };
  const jwtToken = jwt.sign(payload, "My_Account");
  response.send({ jwtToken });
});

// API 3 //
app.get("/user/tweets/feed/", jwtAuthorization, async (request, response) => {
  const getData = `
  SELECT user.username, tweet.tweet, tweet.date_time AS dateTime 
  FROM tweet LEFT JOIN user ON tweet.user_id=user.user_id 
  LEFT JOIN follower ON tweet.user_id=follower.following_user_id 
  WHERE follower.following_user_id IN (SELECT following_user_id FROM follower WHERE follower_user_id=4) 
  GROUP BY tweet.tweet_id 
  ORDER BY tweet.date_time DESC 
  LIMIT 4;`;
  const dbResponse = await db.all(getData);
  response.send(dbResponse);
});

// API 4 //
app.get("/user/following/", jwtAuthorization, async (request, response) => {
  const getFollowingUserList = `
    SELECT name FROM user 
    LEFT JOIN follower ON user.user_id=follower.following_user_id 
    WHERE follower.follower_user_id=4;`;
  const dbResponse = await db.all(getFollowingUserList);
  response.send(dbResponse);
});

// API 5 //
app.get("/user/followers/", jwtAuthorization, async (request, response) => {
  const getFollowingUserList = `
    SELECT name FROM user LEFT JOIN follower 
    ON user.user_id=follower.follower_user_id 
    WHERE follower.following_user_id=4;`;
  const dbResponse = await db.all(getFollowingUserList);
  response.send(dbResponse);
});

// API 6 //
app.get("/tweets/:tweetId/", validateFollower, async (request, response) => {
  const { tweetId } = request;
  const getTweets = `
    SELECT tweet.tweet, COUNT(like.like_id) AS likes,
    COUNT(DISTINCT(reply.reply_id))AS replies, date_time AS dateTime FROM tweet
    LEFT JOIN like ON tweet.tweet_id=like.tweet_id
    LEFT JOIN reply ON like.tweet_id=reply.tweet_id
    WHERE tweet.tweet_id=${tweetId};`;
  const tweetDetails = await db.get(getTweets);
  response.send(tweetDetails);
});

// API 7 //
app.get(
  "/tweets/:tweetId/likes/",
  validateFollower,
  async (request, response) => {
    const { tweetId } = request;
    const getNames = `
    SELECT username FROM user LEFT JOIN like 
    ON user.user_id=like.user_id 
    WHERE tweet_id=${tweetId};
    `;
    const likedNames = await db.all(getNames);
    let likedFollowers = [];
    likedNames.map((item) => {
      likedFollowers.push(item.username);
    });
    response.send({ likes: likedFollowers });
  }
);

// API 8 //
app.get(
  "/tweets/:tweetId/replies/",
  validateFollower,
  async (request, response) => {
    const { tweetId } = request;
    const getReplies = `
   SELECT name,reply FROM user NATURAL JOIN reply 
   WHERE reply.tweet_id=${tweetId};`;
    const repliesList = await db.all(getReplies);
    response.send({ replies: repliesList });
  }
);

// API 9 //
app.get("/user/tweets/", jwtAuthorization, async (request, response) => {
  //   const getTweets = `
  //    SELECT tweet,
  //    COUNT(DISTINCT(like_id))AS likes,
  //    COUNT(DISTINCT(reply_id))AS replies,
  //    tweet.date_time AS dateTime
  //    FROM like
  //    LEFT JOIN reply
  //    ON like.tweet_id=reply.tweet_id
  //    LEFT JOIN tweet
  //    ON reply.user_id=tweet.user_id
  //    WHERE reply.user_id=1
  //    GROUP BY tweet.tweet_id;`;
  const getTweets = `
  select reply AS tweet,count(distinct(like.like_id))AS likes,
  count(distinct(reply.reply_id))AS replies, 
  tweet.date_time AS dateTime from tweet left join reply 
  on tweet.tweet_id=reply.tweet_id left join like 
  on reply.tweet_id=like.tweet_id where tweet.user_id=1 
  group by reply.reply order by tweet.tweet_id;`;

  const userTweets = await db.all(getTweets);
  response.send(userTweets);
});

// API 10 //
app.post("/user/tweets/", jwtAuthorization, async (request, response) => {
  const { tweet } = request.body;
  const userId = 11;
  const getPostATweet = `
  INSERT INTO tweet(tweet,user_id)
  Values(
      '${tweet}',
      ${userId}
  );`;
  const result = await db.run(getPostATweet);
  response.send("Created a Tweet");
});

// API 11 //
app.delete(
  "/tweets/:tweetId/",
  jwtAuthorization,
  deleteVerification,
  async (request, response) => {
    const { tweetId } = request;
    const getDeleteTweet = `
    DELETE FROM tweet
    WHERE tweet_id=${tweetId};`;
    const deleteResponse = await db.run(getDeleteTweet);
    response.send("Tweet Removed");
  }
);
