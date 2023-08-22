/**
 * 反代 Uptimerobot API
 */

const Router = require("koa-router");
const statusRouter = new Router();
const axios = require("axios");

// 调用路径
const url = "https://api.uptimerobot.com/v2/getMonitors";

// GET
statusRouter.get("/status", async (ctx) => {
  ctx.status = 400;
  ctx.body = {
    code: 400,
    message: "请使用 POST 请求",
  };
});

// POST
statusRouter.post("/status", async (ctx) => {
  try {
    // 在这里调用 Uptimerobot API
    const response = await axios.post(url, ctx.request.body, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
    // 将 Uptimerobot API 的响应返回给客户端
    ctx.body = response.data;
  } catch (error) {
    console.error("Uptimerobot API 请求失败：", error);
    ctx.status = 500;
    ctx.body = {
      code: 500,
      message: "Uptimerobot API 请求失败",
    };
  }
});

module.exports = statusRouter;
