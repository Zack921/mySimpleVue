/*  基于响应式 和 diff 的简易vue框架 */
/* 虚拟节点部分 */
// 定义虚拟节点
function vnode(tag, data, children, text, elm){
	this.tag = tag;
	this.data = data;
	this.children = children;
	this.text = text;
	this.elm = elm;
}

// 创建虚拟节点
function createElement(tag, data, children){
  return new vnode(tag, data, normalizeChildren(children));
}

// 规格化子节点
function normalizeChildren(children){
	if(typeof children === 'string'){
			return [createTextVNode(children)];
	}
	return children;
}

// 创建文本节点
function createTextVNode(text){
  return new vnode(undefined, undefined, undefined, text, undefined);
}

// 通过真实dom元素创造空的vnode
function emptyVnodeFromElm(elm){
	return new vnode(elm.tagName.toLowerCase(),{},[],undefined,elm);
}

// 通过虚拟节点生成真实dom节点
function createElm(vnode){
	const tag = vnode.tag;
	const data = vnode.data;
	const children = vnode.children;

	if(tag !== undefined){
		vnode.elm = document.createElement(tag);// 创建dom节点

		if(data.attrs !== undefined){
			const attrs = data.attrs;
			for(let key in attrs){
				vnode.elm.setAttribute(key, attrs[key]);// 设置dom节点属性
			}
		}

		if(children){
			createChildren(vnode, children);// 将子节点变为真实DOM节点，并插入到vnode.elm的子节点上
		}

	}else{
		vnode.elm = document.createTextNode(vnode.text);// 创建文本节点
	}

	return vnode.elm;
}

// 将子节点变为真实DOM节点，并插入到vnode.elm的子节点上
function createChildren(vnode, children){
	children.forEach((child)=>{
		vnode.elm.appendChild(createElm(child));
	});
}

/* vue部分 */
// 定义VUE构造函数
function Vue(options){
	const vm = this;
	vm.$options = options;// 丰满vm.$options属性
	initData(vm);// 初始化data，使属性成为响应式
	vm.mount(document.querySelector(options.el));// 将vm实例挂载到真实DOM元素
}

// vue实例挂载到dom元素
Vue.prototype.mount = function(el){
	const vm = this;
	vm.$el = el;
	// 为渲染函数设置一个观察者-渲染函数观察者
	new Watcher(vm, function(){
		vm.update(vm.render());// 将render生成的vnode挂载到dom元素
	});
}

// render成vnode节点
Vue.prototype.render = function(){
	const vm = this;
	return vm.$options.render.call(vm);
}

// 将vnode挂载到dom元素上
Vue.prototype.update = function(vnode){
	const vm = this;
	const preVnode = vm._vnode;
	vm._vnode = vnode;
	if(!preVnode){// 不存在老虚拟节点
		vm.$el = vm.patch(vm.$el,vnode);// 第一次挂载
	}else{
		vm.$el = vm.patch(preVnode,vnode);// 更新
	}
}

Vue.prototype.patch = patch;

/* diff */
function patch(oldVnode, newVnode){
	const isRealElement = oldVnode.nodeType !== undefined;// 只有真实DOM节点有nodeType属性
	if(!isRealElement && sameVnode(oldVnode,newVnode)){// 同一类型
		patchVnode(oldVnode,newVnode);// 更新
	}else{// oldVnode为真实dom元素 或者 新旧节点不为同一类型
		// 暴力增删
		if(isRealElement){
			oldVnode = emptyVnodeFromElm(oldVnode);// 创造空节点
		}
		const elm = oldVnode.elm;// 旧节点指向的真实dom元素
		const parentDom = elm.parentNode;// 真实dom父元素
		createElm(newVnode);// 用新节点生成真实dom节点
		parentDom.insertBefore(newVnode.elm,elm);
		parentDom.removeChild(elm);
	}
}

// 判断是否为同类节点
function sameVnode(oldVnode, newVnode){
	return oldVnode.tag === newVnode.tag;
}

// 更新节点
function patchVnode(oldVnode,newVnode){
	const elm = newVnode.elm = oldVnode.elm;
	const oldCh = oldVnode.children;
	const newCh = newVnode.children;

	if(!newVnode.text){// 当新节点不为文本节点
		if(oldCh && newCh){
			updateChildren(oldCh, newCh);// 比较子节点序列
		}
	}else if(oldVnode.text !== newVnode.text){
		elm.textContent = newVnode.text;// 直接设置文本
	}
}

// 比较子节点序列
function updateChildren(oldCh, newCh){
	// 假设每一个元素只有一个子节点
	if(sameVnode(oldCh[0], newCh[0])){
		patchVnode(oldCh[0], newCh[0]);
	}else{
		patch(oldCh[0], newCh[0]);
	}
}

// 初始化data数据对象，响应式的开端
// vm.x 是给开发者访问的 vm.$data.x是vue自己内部使用的
function initData(vm){
	const data = vm.$data = vm.$options.data;
	for(let key in data){
			proxy(vm, key);// 给data中每一个属性设置第一层基本代理
	}
	observe(data);// 观察整个data数据对象
}

// 设置第一层基本代理 
// 设置同名属性，使 vm.key => vm.$data.key
function proxy(vm, key){
	Object.defineProperty(vm, key, {
		configurable: true,// 可配置
		enumerable: true,// 可枚举
		get: function(){
			return vm.$data[key];
		},
		set: function(value){
			vm.$data[key] = value;
		}
	})
}

// 监测对象，让对象中的每一个属性成为响应式
function observe(obj){
	for(let key in obj){
		defineReactive(obj, key, obj[key]);
	}
}

// 使属性成为响应式，是整个响应式原理的核心函数
function defineReactive(obj, key, value){
	const dep = new Dep();// 每个属性对应一个dep-闭包
	var oldValue = value;
	// 给vm.$data的数据设置响应式代理
	Object.defineProperty(obj, key, {
		get: function(){
			if(Dep.target){
				dep.depend();// 收集依赖
			}
			return oldValue;
		},
		set: function(newVal){
			if (newVal === oldValue){
				return;
			}else{
				oldValue = newVal;
				dep.notify();
			}		
		}
	});
}

/* dep部分 */
// 定义全局变量
var $uid = 0;
Dep.target = null;
// 定义构造函数
function Dep(){
	this.subs = [];
	this.id = $uid++;
}

// 添加依赖
Dep.prototype.addSub = function(watcher){
	this.subs.push(watcher);
}

// 收集依赖
Dep.prototype.depend = function(){
	if(Dep.target){
		Dep.target.addDep(this);
	}
}

// 触发依赖
Dep.prototype.notify = function(){
	const subs = this.subs.slice();
	subs.forEach((watcher)=>{
		watcher.update();
	});
}

/* watcher(依赖)部分 */
// 定义构造函数
function Watcher(vm, expOrFn, cb){
	this.vm = vm;
	this.getter = expOrFn;// 观察的对象
	this.cb = cb;
	this.depIds = [];// 涉及的dep
	this.value = this.get();// 执行监测的对象-渲染函数
}

Watcher.prototype.get = function(){
	Dep.target = this;// 将此观察者置为即将被收集的全局对象
	const value = this.getter();// 执行监测的对象-渲染函数-重新渲染的关键
	Dep.target = null;// 清空全局对象
	return value;
}

// 添加涉及的dep，即需要的数据属性
Watcher.prototype.addDep = function(dep){
	const id = dep.$uid;
	if(this.depIds.indexOf(id) !== -1){
		this.depIds.push(id);
	}
	dep.addSub(this);
}

// 触发更新
Watcher.prototype.update = function () {
	var value = this.get();// 触发渲染函数观察者的重新渲染
	if (this.value !== value) {
			var oldValue = this.value;
			this.value = value;
			this.cb.call(this.vm, value, oldValue);
	}
}