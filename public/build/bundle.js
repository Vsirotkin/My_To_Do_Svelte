
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }

    function destroy_block(block, lookup) {
        block.d(1);
        lookup.delete(block.key);
    }
    function update_keyed_each(old_blocks, dirty, get_key, dynamic, ctx, list, lookup, node, destroy, create_each_block, next, get_context) {
        let o = old_blocks.length;
        let n = list.length;
        let i = o;
        const old_indexes = {};
        while (i--)
            old_indexes[old_blocks[i].key] = i;
        const new_blocks = [];
        const new_lookup = new Map();
        const deltas = new Map();
        i = n;
        while (i--) {
            const child_ctx = get_context(ctx, list, i);
            const key = get_key(child_ctx);
            let block = lookup.get(key);
            if (!block) {
                block = create_each_block(key, child_ctx);
                block.c();
            }
            else if (dynamic) {
                block.p(child_ctx, dirty);
            }
            new_lookup.set(key, new_blocks[i] = block);
            if (key in old_indexes)
                deltas.set(key, Math.abs(i - old_indexes[key]));
        }
        const will_move = new Set();
        const did_move = new Set();
        function insert(block) {
            transition_in(block, 1);
            block.m(node, next);
            lookup.set(block.key, block);
            next = block.first;
            n--;
        }
        while (o && n) {
            const new_block = new_blocks[n - 1];
            const old_block = old_blocks[o - 1];
            const new_key = new_block.key;
            const old_key = old_block.key;
            if (new_block === old_block) {
                // do nothing
                next = new_block.first;
                o--;
                n--;
            }
            else if (!new_lookup.has(old_key)) {
                // remove old block
                destroy(old_block, lookup);
                o--;
            }
            else if (!lookup.has(new_key) || will_move.has(new_key)) {
                insert(new_block);
            }
            else if (did_move.has(old_key)) {
                o--;
            }
            else if (deltas.get(new_key) > deltas.get(old_key)) {
                did_move.add(new_key);
                insert(new_block);
            }
            else {
                will_move.add(old_key);
                o--;
            }
        }
        while (o--) {
            const old_block = old_blocks[o];
            if (!new_lookup.has(old_block.key))
                destroy(old_block, lookup);
        }
        while (n)
            insert(new_blocks[n - 1]);
        return new_blocks;
    }
    function validate_each_keys(ctx, list, get_context, get_key) {
        const keys = new Set();
        for (let i = 0; i < list.length; i++) {
            const key = get_key(get_context(ctx, list, i));
            if (keys.has(key)) {
                throw new Error(`Cannot have duplicate keys in a keyed each`);
            }
            keys.add(key);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.24.1' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev("SvelteDOMInsert", { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev("SvelteDOMInsert", { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev("SvelteDOMRemove", { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ["capture"] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev("SvelteDOMAddEventListener", { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev("SvelteDOMRemoveEventListener", { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev("SvelteDOMRemoveAttribute", { node, attribute });
        else
            dispatch_dev("SvelteDOMSetAttribute", { node, attribute, value });
    }
    function prop_dev(node, property, value) {
        node[property] = value;
        dispatch_dev("SvelteDOMSetProperty", { node, property, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev("SvelteDOMSetData", { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error(`'target' is a required option`);
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn(`Component was already destroyed`); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src/components/Todos.svelte generated by Svelte v3.24.1 */

    const file = "src/components/Todos.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[6] = list[i];
    	child_ctx[7] = list;
    	child_ctx[8] = i;
    	return child_ctx;
    }

    // (73:4) {:else}
    function create_else_block(ctx) {
    	let li;

    	const block = {
    		c: function create() {
    			li = element("li");
    			li.textContent = "Nothing to do here!";
    			add_location(li, file, 73, 4, 2319);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, li, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(li);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(73:4) {:else}",
    		ctx
    	});

    	return block;
    }

    // (50:4) {#each todos as todo (todo.id)}
    function create_each_block(key_1, ctx) {
    	let li;
    	let div2;
    	let div0;
    	let input;
    	let input_id_value;
    	let input_checked_value;
    	let t0;
    	let label;
    	let t1_value = /*todo*/ ctx[6].name + "";
    	let t1;
    	let label_for_value;
    	let t2;
    	let div1;
    	let button0;
    	let t3;
    	let span0;
    	let t4_value = /*todo*/ ctx[6].name + "";
    	let t4;
    	let t5;
    	let button1;
    	let t6;
    	let span1;
    	let t7_value = /*todo*/ ctx[6].name + "";
    	let t7;
    	let t8;
    	let mounted;
    	let dispose;

    	function click_handler(...args) {
    		return /*click_handler*/ ctx[4](/*todo*/ ctx[6], /*each_value*/ ctx[7], /*todo_index*/ ctx[8], ...args);
    	}

    	function click_handler_1(...args) {
    		return /*click_handler_1*/ ctx[5](/*todo*/ ctx[6], ...args);
    	}

    	const block = {
    		key: key_1,
    		first: null,
    		c: function create() {
    			li = element("li");
    			div2 = element("div");
    			div0 = element("div");
    			input = element("input");
    			t0 = space();
    			label = element("label");
    			t1 = text(t1_value);
    			t2 = space();
    			div1 = element("div");
    			button0 = element("button");
    			t3 = text("Edit ");
    			span0 = element("span");
    			t4 = text(t4_value);
    			t5 = space();
    			button1 = element("button");
    			t6 = text("Delete ");
    			span1 = element("span");
    			t7 = text(t7_value);
    			t8 = space();
    			attr_dev(input, "type", "checkbox");
    			attr_dev(input, "id", input_id_value = "todo-" + /*todo*/ ctx[6].id);
    			input.checked = input_checked_value = /*todo*/ ctx[6].completed;
    			add_location(input, file, 53, 10, 1636);
    			attr_dev(label, "for", label_for_value = "todo-" + /*todo*/ ctx[6].id);
    			attr_dev(label, "class", "todo-label");
    			add_location(label, file, 58, 10, 1815);
    			attr_dev(div0, "class", "c-cb");
    			add_location(div0, file, 52, 8, 1607);
    			attr_dev(span0, "class", "visually-hidden");
    			add_location(span0, file, 62, 17, 1993);
    			attr_dev(button0, "type", "button");
    			attr_dev(button0, "class", "btn");
    			add_location(button0, file, 61, 10, 1941);
    			attr_dev(span1, "class", "visually-hidden");
    			add_location(span1, file, 67, 19, 2196);
    			attr_dev(button1, "type", "button");
    			attr_dev(button1, "class", "btn btn__danger");
    			add_location(button1, file, 64, 10, 2072);
    			attr_dev(div1, "class", "btn-group");
    			add_location(div1, file, 60, 8, 1907);
    			attr_dev(div2, "class", "stack-small");
    			add_location(div2, file, 51, 6, 1573);
    			attr_dev(li, "class", "todo");
    			add_location(li, file, 50, 4, 1549);
    			this.first = li;
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, li, anchor);
    			append_dev(li, div2);
    			append_dev(div2, div0);
    			append_dev(div0, input);
    			append_dev(div0, t0);
    			append_dev(div0, label);
    			append_dev(label, t1);
    			append_dev(div2, t2);
    			append_dev(div2, div1);
    			append_dev(div1, button0);
    			append_dev(button0, t3);
    			append_dev(button0, span0);
    			append_dev(span0, t4);
    			append_dev(div1, t5);
    			append_dev(div1, button1);
    			append_dev(button1, t6);
    			append_dev(button1, span1);
    			append_dev(span1, t7);
    			append_dev(li, t8);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input, "click", click_handler, false, false, false),
    					listen_dev(button1, "click", click_handler_1, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty & /*todos*/ 1 && input_id_value !== (input_id_value = "todo-" + /*todo*/ ctx[6].id)) {
    				attr_dev(input, "id", input_id_value);
    			}

    			if (dirty & /*todos*/ 1 && input_checked_value !== (input_checked_value = /*todo*/ ctx[6].completed)) {
    				prop_dev(input, "checked", input_checked_value);
    			}

    			if (dirty & /*todos*/ 1 && t1_value !== (t1_value = /*todo*/ ctx[6].name + "")) set_data_dev(t1, t1_value);

    			if (dirty & /*todos*/ 1 && label_for_value !== (label_for_value = "todo-" + /*todo*/ ctx[6].id)) {
    				attr_dev(label, "for", label_for_value);
    			}

    			if (dirty & /*todos*/ 1 && t4_value !== (t4_value = /*todo*/ ctx[6].name + "")) set_data_dev(t4, t4_value);
    			if (dirty & /*todos*/ 1 && t7_value !== (t7_value = /*todo*/ ctx[6].name + "")) set_data_dev(t7, t7_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(li);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(50:4) {#each todos as todo (todo.id)}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let div2;
    	let form;
    	let h20;
    	let label;
    	let t1;
    	let input;
    	let t2;
    	let button0;
    	let t4;
    	let div0;
    	let button1;
    	let span0;
    	let t6;
    	let span1;
    	let t8;
    	let span2;
    	let t10;
    	let button2;
    	let span3;
    	let t12;
    	let span4;
    	let t14;
    	let span5;
    	let t16;
    	let button3;
    	let span6;
    	let t18;
    	let span7;
    	let t20;
    	let span8;
    	let t22;
    	let h21;
    	let t23;
    	let t24;
    	let t25;
    	let t26;
    	let t27;
    	let ul;
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let t28;
    	let hr;
    	let t29;
    	let div1;
    	let button4;
    	let t31;
    	let button5;
    	let each_value = /*todos*/ ctx[0];
    	validate_each_argument(each_value);
    	const get_key = ctx => /*todo*/ ctx[6].id;
    	validate_each_keys(ctx, each_value, get_each_context, get_key);

    	for (let i = 0; i < each_value.length; i += 1) {
    		let child_ctx = get_each_context(ctx, each_value, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block(key, child_ctx));
    	}

    	let each_1_else = null;

    	if (!each_value.length) {
    		each_1_else = create_else_block(ctx);
    	}

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			form = element("form");
    			h20 = element("h2");
    			label = element("label");
    			label.textContent = "What needs to be done?";
    			t1 = space();
    			input = element("input");
    			t2 = space();
    			button0 = element("button");
    			button0.textContent = "Add";
    			t4 = space();
    			div0 = element("div");
    			button1 = element("button");
    			span0 = element("span");
    			span0.textContent = "Show";
    			t6 = space();
    			span1 = element("span");
    			span1.textContent = "All";
    			t8 = space();
    			span2 = element("span");
    			span2.textContent = "tasks";
    			t10 = space();
    			button2 = element("button");
    			span3 = element("span");
    			span3.textContent = "Show";
    			t12 = space();
    			span4 = element("span");
    			span4.textContent = "Active";
    			t14 = space();
    			span5 = element("span");
    			span5.textContent = "tasks";
    			t16 = space();
    			button3 = element("button");
    			span6 = element("span");
    			span6.textContent = "Show";
    			t18 = space();
    			span7 = element("span");
    			span7.textContent = "Completed";
    			t20 = space();
    			span8 = element("span");
    			span8.textContent = "tasks";
    			t22 = space();
    			h21 = element("h2");
    			t23 = text(/*completedTodos*/ ctx[2]);
    			t24 = text(" out of ");
    			t25 = text(/*totalTodos*/ ctx[1]);
    			t26 = text(" items completed!");
    			t27 = space();
    			ul = element("ul");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			if (each_1_else) {
    				each_1_else.c();
    			}

    			t28 = space();
    			hr = element("hr");
    			t29 = space();
    			div1 = element("div");
    			button4 = element("button");
    			button4.textContent = "Check all";
    			t31 = space();
    			button5 = element("button");
    			button5.textContent = "Remove completed";
    			attr_dev(label, "for", "todo-0");
    			attr_dev(label, "class", "label__lg");
    			add_location(label, file, 17, 6, 376);
    			attr_dev(h20, "class", "label-wrapper");
    			add_location(h20, file, 16, 4, 343);
    			attr_dev(input, "type", "text");
    			attr_dev(input, "id", "todo-0");
    			attr_dev(input, "autocomplete", "off");
    			attr_dev(input, "class", "input input__lg");
    			add_location(input, file, 19, 4, 461);
    			attr_dev(button0, "type", "submit");
    			button0.disabled = "";
    			attr_dev(button0, "class", "btn btn__primary btn__lg");
    			add_location(button0, file, 20, 4, 542);
    			add_location(form, file, 15, 2, 332);
    			attr_dev(span0, "class", "visually-hidden");
    			add_location(span0, file, 28, 6, 775);
    			add_location(span1, file, 29, 6, 823);
    			attr_dev(span2, "class", "visually-hidden");
    			add_location(span2, file, 30, 6, 846);
    			attr_dev(button1, "class", "btn toggle-btn");
    			attr_dev(button1, "aria-pressed", "true");
    			add_location(button1, file, 27, 4, 717);
    			attr_dev(span3, "class", "visually-hidden");
    			add_location(span3, file, 33, 6, 966);
    			add_location(span4, file, 34, 6, 1014);
    			attr_dev(span5, "class", "visually-hidden");
    			add_location(span5, file, 35, 6, 1040);
    			attr_dev(button2, "class", "btn toggle-btn");
    			attr_dev(button2, "aria-pressed", "false");
    			add_location(button2, file, 32, 4, 907);
    			attr_dev(span6, "class", "visually-hidden");
    			add_location(span6, file, 38, 6, 1160);
    			add_location(span7, file, 39, 6, 1208);
    			attr_dev(span8, "class", "visually-hidden");
    			add_location(span8, file, 40, 6, 1237);
    			attr_dev(button3, "class", "btn toggle-btn");
    			attr_dev(button3, "aria-pressed", "false");
    			add_location(button3, file, 37, 4, 1101);
    			attr_dev(div0, "class", "filters btn-group stack-exception");
    			add_location(div0, file, 26, 2, 665);
    			attr_dev(h21, "id", "list-heading");
    			add_location(h21, file, 45, 2, 1329);
    			attr_dev(ul, "role", "list");
    			attr_dev(ul, "class", "todo-list stack-large");
    			attr_dev(ul, "aria-labelledby", "list-heading");
    			add_location(ul, file, 48, 2, 1431);
    			add_location(hr, file, 77, 2, 2371);
    			attr_dev(button4, "type", "button");
    			attr_dev(button4, "class", "btn btn__primary");
    			add_location(button4, file, 81, 4, 2432);
    			attr_dev(button5, "type", "button");
    			attr_dev(button5, "class", "btn btn__primary");
    			add_location(button5, file, 82, 4, 2502);
    			attr_dev(div1, "class", "btn-group");
    			add_location(div1, file, 80, 2, 2404);
    			attr_dev(div2, "class", "todoapp stack-large");
    			add_location(div2, file, 13, 0, 277);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, form);
    			append_dev(form, h20);
    			append_dev(h20, label);
    			append_dev(form, t1);
    			append_dev(form, input);
    			append_dev(form, t2);
    			append_dev(form, button0);
    			append_dev(div2, t4);
    			append_dev(div2, div0);
    			append_dev(div0, button1);
    			append_dev(button1, span0);
    			append_dev(button1, t6);
    			append_dev(button1, span1);
    			append_dev(button1, t8);
    			append_dev(button1, span2);
    			append_dev(div0, t10);
    			append_dev(div0, button2);
    			append_dev(button2, span3);
    			append_dev(button2, t12);
    			append_dev(button2, span4);
    			append_dev(button2, t14);
    			append_dev(button2, span5);
    			append_dev(div0, t16);
    			append_dev(div0, button3);
    			append_dev(button3, span6);
    			append_dev(button3, t18);
    			append_dev(button3, span7);
    			append_dev(button3, t20);
    			append_dev(button3, span8);
    			append_dev(div2, t22);
    			append_dev(div2, h21);
    			append_dev(h21, t23);
    			append_dev(h21, t24);
    			append_dev(h21, t25);
    			append_dev(h21, t26);
    			append_dev(div2, t27);
    			append_dev(div2, ul);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(ul, null);
    			}

    			if (each_1_else) {
    				each_1_else.m(ul, null);
    			}

    			append_dev(div2, t28);
    			append_dev(div2, hr);
    			append_dev(div2, t29);
    			append_dev(div2, div1);
    			append_dev(div1, button4);
    			append_dev(div1, t31);
    			append_dev(div1, button5);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*completedTodos*/ 4) set_data_dev(t23, /*completedTodos*/ ctx[2]);
    			if (dirty & /*totalTodos*/ 2) set_data_dev(t25, /*totalTodos*/ ctx[1]);

    			if (dirty & /*removeTodo, todos*/ 9) {
    				const each_value = /*todos*/ ctx[0];
    				validate_each_argument(each_value);
    				validate_each_keys(ctx, each_value, get_each_context, get_key);
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, ul, destroy_block, create_each_block, null, get_each_context);

    				if (each_value.length) {
    					if (each_1_else) {
    						each_1_else.d(1);
    						each_1_else = null;
    					}
    				} else if (!each_1_else) {
    					each_1_else = create_else_block(ctx);
    					each_1_else.c();
    					each_1_else.m(ul, null);
    				}
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d();
    			}

    			if (each_1_else) each_1_else.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { todos = [] } = $$props;

    	function removeTodo(todo) {
    		$$invalidate(0, todos = todos.filter(t => t.id !== todo.id));
    	}

    	const writable_props = ["todos"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Todos> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Todos", $$slots, []);
    	const click_handler = (todo, each_value, todo_index) => $$invalidate(0, each_value[todo_index].completed = !todo.completed, todos);
    	const click_handler_1 = todo => removeTodo(todo);

    	$$self.$$set = $$props => {
    		if ("todos" in $$props) $$invalidate(0, todos = $$props.todos);
    	};

    	$$self.$capture_state = () => ({
    		todos,
    		removeTodo,
    		totalTodos,
    		completedTodos
    	});

    	$$self.$inject_state = $$props => {
    		if ("todos" in $$props) $$invalidate(0, todos = $$props.todos);
    		if ("totalTodos" in $$props) $$invalidate(1, totalTodos = $$props.totalTodos);
    		if ("completedTodos" in $$props) $$invalidate(2, completedTodos = $$props.completedTodos);
    	};

    	let totalTodos;
    	let completedTodos;

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*todos*/ 1) {
    			 $$invalidate(1, totalTodos = todos.length);
    		}

    		if ($$self.$$.dirty & /*todos*/ 1) {
    			 $$invalidate(2, completedTodos = todos.filter(todo => todo.completed).length);
    		}
    	};

    	return [todos, totalTodos, completedTodos, removeTodo, click_handler, click_handler_1];
    }

    class Todos extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, { todos: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Todos",
    			options,
    			id: create_fragment.name
    		});
    	}

    	get todos() {
    		throw new Error("<Todos>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set todos(value) {
    		throw new Error("<Todos>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/App.svelte generated by Svelte v3.24.1 */

    function create_fragment$1(ctx) {
    	let todos_1;
    	let current;

    	todos_1 = new Todos({
    			props: { todos: /*todos*/ ctx[0] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(todos_1.$$.fragment);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			mount_component(todos_1, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(todos_1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(todos_1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(todos_1, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let todos = [
    		{
    			id: 1,
    			name: "Create a Svelte starter app",
    			completed: true
    		},
    		{
    			id: 2,
    			name: "Create your first component",
    			completed: true
    		},
    		{
    			id: 3,
    			name: "Complete the rest of the tutorial",
    			completed: false
    		}
    	];

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("App", $$slots, []);
    	$$self.$capture_state = () => ({ Todos, todos });

    	$$self.$inject_state = $$props => {
    		if ("todos" in $$props) $$invalidate(0, todos = $$props.todos);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [todos];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment$1.name
    		});
    	}
    }

    const app = new App({
    	target: document.body,
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
