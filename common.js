/**
     * 生成一周日期
     */
    function getWeekTime() {
      return [...new Array(7)].map((j, i) => new Date(Date.now() + i * 8.64e7).toLocaleDateString());
    }

    /**
     * 判断是否为某类型
     * @param {any} target 
     * @param {string} type 
     * @return {boolean}
     */
    function isType(target, type) {
      let targetType = Object.prototype.toString.call(target).slice(8, -1).toLowerCase();
      return targetType === type.toLowerCase();
    }

    /**
     * 对象属性剔除
     * @param {object} object 
     * @param {string[]} props 
     * @return {object}
     */
    function omit(object, props = []) {
      let res = {};
      Object.keys(object).forEach(key => {
        if (!props.includes(key)) {
          res[key] = typeof object[key] === 'object' && object[key] !== null ?
            // 深度拷贝
            JSON.parse(JSON.stringify(object[key])) :
            object[key];
        }
      })
      return res;
    }

    /**
     * 日期格式化
     * @param {string} formate 
     * @param {number} timestamp - 时间戳
     * @returns {string}
     */
    function formatDate(formate = 'Y-M-D h:m', timestamp = Date.now()) {
      let date = new Date(timestamp);
      let dateInfo = {
        Y: date.getFullYear(),
        M: date.getMonth() + 1,
        D: date.getDate(),
        h: date.getHours(),
        m: date.getMinutes(),
        s: date.getSeconds()
      }
      let formatNumber = n => n > 10 ? n : `0${n}`;
      let res = format
        .replace('Y', dateInfo.Y)
        .replace('M', dateInfo.M)
        .replace('D', dateInfo.D)
        .replace('h', formatNumber(dateInfo.h))
        .replace('m', formatNumber(dateInfo.m))
        .replace('s', formatNumber(dateInfo.s));

      return res;
    }

    /**
     * 函数防抖
     * @param {fucntion} func - 执行函数
     * @param {number} wait - 等待时间
     * @param {boolean} immediate - 是否立即执行
     * @return {function}
     */
    function debounce(func, wait = 300, immediate) {
      let timer, ctx;
      let later = arg => setTimeout(() => {
        func.apply(ctx, arg);
        timer = ctx = null;
      }, wait);

      return function (...arg) {
        if (!timer) {
          timer = later(arg);
          ctx = this;
          if (immediate) {
            func.apply(ctx, arg);
          }
        } else {
          clearTimeout(timer);
          timer = later(arg);
        }
      }
    }

    /**
     * 函数节流
     * @param {function} func - 执行函数
     * @param {number} delay - 延迟时间
     * @return {function}
     */
    function throttle(func, delay) {
      let timer = null;
      return function (...arg) {
        if (!timer) {
          timer = setTimeout(() => {
            func.apply(this, arg);
            timer = null;
          }, delay)
        }
      }
    }

    /**
     * 识别浏览器及平台
     */
    function getPlatformInfo() {
      // 运行环境是浏览器
      let inBrowser = typeof window !== 'undefined';
      // 运行环境是微信
      let inWeex = typeof WXEnvironment !== 'undefined' && !!WXEnvironment.platform;
      let weexPlatform = inWeex && WXEnvironment.platform.toLowerCase();
      // 浏览器 UA 判断
      let UA = inBrowser && window.navigator.userAgent.toLowerCase();
      if (UA) {
        let platforms = {
          IE: /msie|trident/.test(UA),
          IE9: UA.indexOf('msie 9.0') > 0,
          Edge: UA.indexOf('edge/') > 0,
          Android: UA.indexOf('android') > 0 || (weexPlatform === 'android'),
          IOS: /iphone|ipad|ipod|ios/.test(UA) || (weexPlatform === 'ios'),
          Chrome: /chrome\/\d+/.test(UA) && !(UA.indexOf('edge/') > 0),
        }
        for (const key in platforms) {
          if (platforms.hasOwnProperty(key)) {
            if (platforms[key]) return key;
          }
        }
      }

    }

    /**
     * 获取目标元素完整的CSS路径
     * @param {node} el 
     * @return {string}
     */
    function getCSSPath(el) {
      if (!(el instanceof Element)) return;
      var path = [];
      // Node.ELEMENT_NODE: 1表示标签节点  3表示文本
      while (el.nodeType === Node.ELEMENT_NODE && el.tagName.toLowerCase() !== 'html') {
        var selector = el.nodeName.toLowerCase();
        // 如果节点有id则直接使用id，否则获取CSS选择器路径
        if (el.id) {
          selector += '#' + el.id;
        } else {
          var siblings = el.parentNode.children; // 获取所有的兄弟节点包括本身
          var isUnique = true; // 兄弟节点中不存在同名节点
          var site = 0; // 在兄弟节点中的位置
          for (var i = 0, len = siblings.length; i < len; i++) {
            // 判断元素节点位置，即父节点下的第几个子节点
            if (siblings[i].isSameNode(el)) { // Node.isSameNode 判断两个元素节点是否是同一个
              site = i + 1;
              continue;
            }
            // 判断兄弟节点中是否有同名标签
            if (siblings[i].nodeName.toLowerCase() === selector) {
              isUnique = false;
            }
          }
          if (!isUnique) {
            selector += ":nth-child(" + site + ")";
          }
        }
        path.unshift(selector);
        el = el.parentNode;
      }
      return path.join(" > ");
    }

    function hasClass(element, cName) {
      return element.className.match(new RegExp("(\\s|^)" + cName + "(\\s|$)"));
    }
    //为指定的dom元素添加样式
    function addClass(element, cName) {
      if (!hasClass(element, cName)) element.className += " " + cName;
    }
    //删除指定dom元素的样式
    function removeClass(element, cName) {
      if (hasClass(element, cName)) {
        var reg = new RegExp("(\\s|^)" + cName + "(\\s|$)");
        element.className = element.className.replace(reg, "");
      }

      if (!element.className) {
        element.removeAttribute('class');
      }
    }

    function parseURL(url) {
      var a = document.createElement('a');
      a.href = url;
      return {
        source: url,
        protocol: a.protocol.replace(':', ''),
        host: a.hostname,
        port: a.port,
        query: a.search,
        params: (function () {
          var ret = {},
            seg = a.search.replace(/^\?/, '').split('&'),
            len = seg.length,
            i = 0,
            s;
          for (; i < len; i++) {
            if (!seg[i]) {
              continue;
            }
            s = seg[i].split('=');
            ret[s[0]] = s[1];
          }
          return ret;
        })(),
        file: (a.pathname.match(/\/([^\/?#]+)$/i) || [, ''])[1],
        hash: a.hash.replace('#', ''),
        path: a.pathname.replace(/^([^\/])/, '/$1'),
        relative: (a.href.match(/tps?:\/\/[^\/]+(.+)/) || [, ''])[1],
        segments: a.pathname.replace(/^\//, '').split('/')
      };
    }
