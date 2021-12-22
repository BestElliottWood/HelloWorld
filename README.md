# Web应用中图片加载优化

### 一、 图片资源大

#### 1 压缩图片
#### 2 渐进式图片

渐进式图片：在加载图片的时候，如果网速比较慢的话，先显示一个类似模糊有点小马赛克的质量比较差的图片，然后慢慢的变为清晰的图片
```
background-image: url("img/beijing.webp"),url("img/beijing.png");
```

#### 3 响应式图片

根据屏幕分辨率大小加载不同分辨率的图片
##### 3.1 img标签
```
<img 
    srcset="1-320w.jpg 320w, 1-480w.jpg 480w, 1-800w.jpg 800w"
    sizes="(max-width: 320px) 280px, (max-width: 480px) 440px, 800px" 
    src="1-800w.jpg"
    alt="背景" 
/>
```
srcset 属性指定图像集以及各图片大小
sizes 属性定义一组媒体条件（屏幕的宽度），以上边为例，当屏幕的宽度小于480px 的时候，图像将填充的槽的宽度是 440px
* 查看设备宽度
* 检查sizes列表中哪个媒体条件是第一个为真
* 查看给予该媒体查询的槽大小
* 加载srcset列表中引用的最接近所选的槽大小的图像

##### 3.2 picture标签
```
<picture>
    <source media="(min-width: 650px)" srcset="1.jpg">
    <source media="(min-width: 465px)" srcset="2.jpg">
    <img src="default.jpg">
</picture>
```
### 二、 图片数量多
#### 1 预加载
##### 1.1 css预加载
给一个实际效果不可见的元素添加css的background属性可以预先加载图片进行缓存，达到预加载的目的
```
<div id="preload-img" style="background: url(http://example.com/image.png)"></div>
```
##### 1.2 js预加载
``` javascript
window.onload = function () {
  const images = [
      'http://example.com/image1.png',
      'http://example.com/image2.png',
      'http://example.com/image3.png',
  ];

  images.forEach((src) => {
    let img = new Image();
    img.src = src;
  })
}   
```
#### 2 懒加载
##### 2.1 img标签的loading属性
指示浏览器应当如何加载该图像。允许的值：
* eager 立即加载图像，不管它是否在可视视口（visible viewport）之外（默认值）。
* lazy 延迟加载图像，直到它和视口接近到一个计算得到的距离，由浏览器定义。

缺点：兼容性差
##### 2.2 图片按需加载
基本思想：
1. 通过预先将图片的src资源指向一张小图片或空，并通过 data-src 来记录其实际图片地址。
2. 通过延迟加载或监听滚动事件（图片出现在可视区域中）， 将 data-src 属性值赋值给 src 实现图片懒加载

```
// 在一开始加载的时候
<img data-src="http://example.com/image.png" src="" />
<div data-src="http://example.com/image.png" style="background-image: none;"></div>

// 在进入可视范围内时
<img data-src="http://xx.com/xx.png" src="http://xx.com/xx.png" />
<div data-src="http://example.com/image.png" style="background-image: url(http://example.com/image.png);"></div>
```
 实现方式：
 1. IntersectionObserver
 ``` javascript
 const observer = new IntersectionObserver((changes) => {
  changes.forEach((element, index) => {
   // intersectionRatio取值范围为[0, 1], 表示元素在视窗内的可见比率，这里只要判断该值大于0
    if (element.intersectionRatio > 0) {
      // 放弃监听，防止性能浪费，并加载图片
      observer.unobserve(element.target);
      element.target.src = element.target.dataset.src;
    }
  });
});
function initObserver() {
  // 所有需要进行元素懒加载的dom
  const listItems = document.querySelectorAll('.list-item-img');
  listItems.forEach(function(item) {
   // 对每个dom元素进行监听
    observer.observe(item);
  });
}
initObserver();
 ```
 2. 计算图片元素在视窗位置距离，判断元素是否在可视范围内
 计算视窗宽高
``` javascript
const viewHeight = window.innerHeight || document.documentElement.clientHeight; // 视窗高度
const viewWidth = window.innerWidth || document.documentElement.clientWidth; // 视窗宽度
```
计算元素位置大小
> Element.getBoundingClientRect() 方法返回元素的大小及其相对于视口的位置
``` javascript
const imgs = document.getElementsByTagName("img"); // 获取所有的图片标签
const viewHeight = window.innerHeight || document.documentElement.clientHeight; // 视窗高度
const viewWidth = window.innerWidth || document.documentElement.clientWidth; // 视窗宽度

function lazyload() {
  imgs.forEach((img) => {
    const dataSrc = img.getAttribute("data-src");
    if(dataSrc) {
      const verticalDistance = viewHeight - img.getBoundingClientRect().top; // 元素距离视窗上侧位置
      const horizontalDistance = viewWidth - img.getBoundingClientRect().left; // 元素距离视窗左侧位置

      if (verticalDistance || horizontalDistance) {
        img.src = dataSrc;
        img.removeAttribute('data-src');
      }
    }
  });
}

// 防抖
function debounce(fn, delay = 500) {
  let timer = null;
  return function (...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn.call(this, args);
    }, delay);
  };
}

// 页面初始化时加载首屏图片
window.onload = lazyload;
// 监听Scroll事件
window.addEventListener("scroll", debounce(lazyload), false);
```
