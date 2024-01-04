/**
 * 获取必应每日背景图片信息
 *
 * @param {string} idx - 指定要获取的图片在历史记录中的索引，从0开始。0表示当天的图片，1表示昨天的图片，依此类推。最大值为7
 * @param {number} n - 指定要获取的图片数量，从1到8。如果n大于idx+1，则返回的图片数量可能小于n
 * @param {string} mkt - 指定地区或市场代码，用于确定背景图片的地域和语言。mkt=zh-CN 表示中文（中国）地区的图片
 * @param {boolean} uhd - 用于指定是否获取超高分辨率（Ultra High Definition）的图片。可选值为 1（启用）或 0（禁用）
 * @param {number} uhdwidth - 如果启用了超高分辨率图片，可以使用这个参数来指定图片的宽度
 * @param {number} uhdheight - 如果启用了超高分辨率图片，可以使用这个参数来指定图片的高度
 */

const { get, set } = require("../utils/cacheData");
const Router = require("koa-router");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const bingRouter = new Router();

// 调用时间
let updateTime = new Date().toISOString();

// 获取列表数据
bingRouter.get("/bing", async (ctx) => {
  try {
    // 获取参数
    let hd = 0;
    const { days = 0, size = 1, width, height } = ctx.query;
    if (days > 7 || size > 8) {
      ctx.status = 500;
      ctx.body = {
        code: 500,
        message: "参数填写错误",
      };
      return;
    }
    if (width || height) hd = 1;

    // 缓存键名
    const params = { name: "bingImagesData", days, size, width, height };
    const cacheKey = JSON.stringify(params);

    // 从缓存中获取数据
    let data = await get(cacheKey);
    const from = data ? "cache" : "server";

    if (!data) {
      // 从服务器拉取数据
      const response = await axios.get(
        `https://cn.bing.com/HPImageArchive.aspx?format=js&idx=${days}&n=${size}&uhd=${hd}&uhdwidth=${width}&uhdheight=${height}&mkt=zh-CN`
      );
      data = getData(response.data?.images);
      updateTime = new Date().toISOString();
      if (!data || !data[0]) {
        ctx.status = 500;
        ctx.body = {
          code: 500,
          message: "获取失败",
        };
        return;
      }
      // 将数据写入缓存
      await set(cacheKey, data);
    }
    ctx.body = {
      code: 200,
      from,
      updateTime,
      images: data,
    };
  } catch (error) {
    console.error(error);
    ctx.status = 500;
    ctx.body = {
      code: 500,
      message: "获取失败",
    };
  }
});

// 显示图片
bingRouter.get("/bing/image", async (ctx) => {
  try {
    // 获取参数
    let hd = 0;
    const { width, height } = ctx.query;
    if (width || height) hd = 1;

    // 获取当前日期，格式为 YYYY-MM-DD
    const currentDate = new Date().toISOString().split("T")[0];

    // 删除昨日过期图片
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const expiredImagePath = path.join(
      cacheDir,
      `${yesterday.toISOString().split("T")[0]}.jpg`
    );
    if (fs.existsSync(expiredImagePath)) {
      fs.unlinkSync(expiredImagePath);
      console.log(`成功删除过期图片: ${expiredImagePath}`);
    }

    // 检查本地是否有今天的图片
    const localImagePath = path.join(cacheDir, `${currentDate}.jpg`);
    if (fs.existsSync(localImagePath)) {
      console.log("触发本地缓存");
      // 如果有本地图片，读取并返回给客户端
      const imageData = fs.readFileSync(localImagePath);
      ctx.response.set("Content-Type", "image/jpeg");
      ctx.body = imageData;
    } else {
      // 没有本地图片，从服务器拉取数据
      const response = await axios.get(
        `https://cn.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1&uhd=${hd}&uhdwidth=${width}&uhdheight=${height}&mkt=zh-CN`
      );
      const imgUrl = `https://cn.bing.com/${response.data.images[0].url}`;

      // 下载图片并将其保存到本地
      const imageResponse = await axios.get(imgUrl, {
        responseType: "arraybuffer",
      });
      const imageData = Buffer.from(imageResponse.data, "binary");
      fs.writeFileSync(localImagePath, imageData);

      // 将图片数据返回给客户端
      ctx.response.set("Content-Type", "image/jpeg");
      ctx.body = imageData;
    }
  } catch (error) {
    console.error(error);
    ctx.status = 500;
    ctx.body = {
      code: 500,
      message: "获取失败",
    };
  }
});

// 本地图片缓存目录
const cacheDir = path.join(process.cwd(), "images");
if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir);
}

// 数据处理
const getData = (data) => {
  if (!data) return [];
  return data.map((v) => {
    return {
      hash: v.hsh,
      startdate: v.startdate,
      enddate: v.enddate,
      title: v.title,
      description: separateDesc(v.copyright)?.description,
      copyright: separateDesc(v.copyright)?.copyright,
      urlbase: v.urlbase,
      url: `https://cn.bing.com/${v.url}`,
      uhdUrl: v.uhdUrl,
      searchLink: v.copyrightlink,
      aboutLink: `https://cn.bing.com/${v.quiz}`,
    };
  });
};

/**
 * 分离描述和版权信息
 * @param {string} value - 包含描述和版权信息的字符串
 * @returns {Object} 包含分离后的描述和版权信息的对象
 */
const separateDesc = (value) => {
  try {
    // 使用正则表达式匹配并提取版权信息
    const copyrightRegex = /\(© ([^\)]+)\)/;
    const match = value.match(copyrightRegex);
    const copyright = match ? match[1] : "";

    // 使用正则表达式删除版权信息
    const description = value.replace(copyrightRegex, "").trim();

    // 返回分离后的结果
    return {
      description: description,
      copyright: copyright,
    };
  } catch (error) {
    console.error("分离描述和版权信息出错:", error);
    return {
      description: "",
      copyright: "",
    };
  }
};

module.exports = bingRouter;
