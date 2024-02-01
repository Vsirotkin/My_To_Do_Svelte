
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
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev("SvelteDOMRemoveAttribute", { node, attribute });
        else
            dispatch_dev("SvelteDOMSetAttribute", { node, attribute, value });
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

    function create_fragment(ctx) {
    	let div11;
    	let form0;
    	let h20;
    	let label0;
    	let t1;
    	let input0;
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
    	let t24;
    	let ul;
    	let li0;
    	let div3;
    	let form1;
    	let div1;
    	let label1;
    	let t26;
    	let input1;
    	let t27;
    	let div2;
    	let button4;
    	let t28;
    	let span9;
    	let t30;
    	let button5;
    	let t31;
    	let span10;
    	let t33;
    	let li1;
    	let div6;
    	let div4;
    	let input2;
    	let t34;
    	let label2;
    	let t36;
    	let div5;
    	let button6;
    	let t37;
    	let span11;
    	let t39;
    	let button7;
    	let t40;
    	let span12;
    	let t42;
    	let li2;
    	let div9;
    	let div7;
    	let input3;
    	let t43;
    	let label3;
    	let t45;
    	let div8;
    	let button8;
    	let t46;
    	let span13;
    	let t48;
    	let button9;
    	let t49;
    	let span14;
    	let t51;
    	let hr;
    	let t52;
    	let div10;
    	let button10;
    	let t54;
    	let button11;

    	const block = {
    		c: function create() {
    			div11 = element("div");
    			form0 = element("form");
    			h20 = element("h2");
    			label0 = element("label");
    			label0.textContent = "What needs to be done?";
    			t1 = space();
    			input0 = element("input");
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
    			h21.textContent = "2 out of 3 items completed";
    			t24 = space();
    			ul = element("ul");
    			li0 = element("li");
    			div3 = element("div");
    			form1 = element("form");
    			div1 = element("div");
    			label1 = element("label");
    			label1.textContent = "New name for 'Create a Svelte starter app'";
    			t26 = space();
    			input1 = element("input");
    			t27 = space();
    			div2 = element("div");
    			button4 = element("button");
    			t28 = text("Cancel\n              ");
    			span9 = element("span");
    			span9.textContent = "renaming Create a Svelte starter app";
    			t30 = space();
    			button5 = element("button");
    			t31 = text("Save\n              ");
    			span10 = element("span");
    			span10.textContent = "new name for Create a Svelte starter app";
    			t33 = space();
    			li1 = element("li");
    			div6 = element("div");
    			div4 = element("div");
    			input2 = element("input");
    			t34 = space();
    			label2 = element("label");
    			label2.textContent = "Create your first component";
    			t36 = space();
    			div5 = element("div");
    			button6 = element("button");
    			t37 = text("Edit\n            ");
    			span11 = element("span");
    			span11.textContent = "Create your first component";
    			t39 = space();
    			button7 = element("button");
    			t40 = text("Delete\n            ");
    			span12 = element("span");
    			span12.textContent = "Create your first component";
    			t42 = space();
    			li2 = element("li");
    			div9 = element("div");
    			div7 = element("div");
    			input3 = element("input");
    			t43 = space();
    			label3 = element("label");
    			label3.textContent = "Complete the rest of the tutorial";
    			t45 = space();
    			div8 = element("div");
    			button8 = element("button");
    			t46 = text("Edit\n            ");
    			span13 = element("span");
    			span13.textContent = "Complete the rest of the tutorial";
    			t48 = space();
    			button9 = element("button");
    			t49 = text("Delete\n            ");
    			span14 = element("span");
    			span14.textContent = "Complete the rest of the tutorial";
    			t51 = space();
    			hr = element("hr");
    			t52 = space();
    			div10 = element("div");
    			button10 = element("button");
    			button10.textContent = "Check all";
    			t54 = space();
    			button11 = element("button");
    			button11.textContent = "Remove completed";
    			attr_dev(label0, "for", "todo-0");
    			attr_dev(label0, "class", "label__lg");
    			add_location(label0, file, 5, 6, 121);
    			attr_dev(h20, "class", "label-wrapper");
    			add_location(h20, file, 4, 4, 88);
    			attr_dev(input0, "type", "text");
    			attr_dev(input0, "id", "todo-0");
    			attr_dev(input0, "autocomplete", "off");
    			attr_dev(input0, "class", "input input__lg");
    			add_location(input0, file, 7, 4, 206);
    			attr_dev(button0, "type", "submit");
    			button0.disabled = "";
    			attr_dev(button0, "class", "btn btn__primary btn__lg");
    			add_location(button0, file, 8, 4, 287);
    			add_location(form0, file, 3, 2, 77);
    			attr_dev(span0, "class", "visually-hidden");
    			add_location(span0, file, 16, 6, 520);
    			add_location(span1, file, 17, 6, 568);
    			attr_dev(span2, "class", "visually-hidden");
    			add_location(span2, file, 18, 6, 591);
    			attr_dev(button1, "class", "btn toggle-btn");
    			attr_dev(button1, "aria-pressed", "true");
    			add_location(button1, file, 15, 4, 462);
    			attr_dev(span3, "class", "visually-hidden");
    			add_location(span3, file, 21, 6, 711);
    			add_location(span4, file, 22, 6, 759);
    			attr_dev(span5, "class", "visually-hidden");
    			add_location(span5, file, 23, 6, 785);
    			attr_dev(button2, "class", "btn toggle-btn");
    			attr_dev(button2, "aria-pressed", "false");
    			add_location(button2, file, 20, 4, 652);
    			attr_dev(span6, "class", "visually-hidden");
    			add_location(span6, file, 26, 6, 905);
    			add_location(span7, file, 27, 6, 953);
    			attr_dev(span8, "class", "visually-hidden");
    			add_location(span8, file, 28, 6, 982);
    			attr_dev(button3, "class", "btn toggle-btn");
    			attr_dev(button3, "aria-pressed", "false");
    			add_location(button3, file, 25, 4, 846);
    			attr_dev(div0, "class", "filters btn-group stack-exception");
    			add_location(div0, file, 14, 2, 410);
    			attr_dev(h21, "id", "list-heading");
    			add_location(h21, file, 33, 2, 1074);
    			attr_dev(label1, "for", "todo-1");
    			attr_dev(label1, "class", "todo-label");
    			add_location(label1, file, 42, 12, 1397);
    			attr_dev(input1, "type", "text");
    			attr_dev(input1, "id", "todo-1");
    			attr_dev(input1, "autocomplete", "off");
    			attr_dev(input1, "class", "todo-text");
    			add_location(input1, file, 45, 12, 1527);
    			attr_dev(div1, "class", "form-group");
    			add_location(div1, file, 41, 10, 1360);
    			attr_dev(span9, "class", "visually-hidden");
    			add_location(span9, file, 54, 14, 1799);
    			attr_dev(button4, "class", "btn todo-cancel");
    			attr_dev(button4, "type", "button");
    			add_location(button4, file, 52, 12, 1717);
    			attr_dev(span10, "class", "visually-hidden");
    			add_location(span10, file, 58, 14, 1998);
    			attr_dev(button5, "class", "btn btn__primary todo-edit");
    			attr_dev(button5, "type", "submit");
    			add_location(button5, file, 56, 12, 1907);
    			attr_dev(div2, "class", "btn-group");
    			add_location(div2, file, 51, 10, 1681);
    			attr_dev(form1, "class", "stack-small");
    			add_location(form1, file, 40, 8, 1323);
    			attr_dev(div3, "class", "stack-small");
    			add_location(div3, file, 39, 6, 1289);
    			attr_dev(li0, "class", "todo");
    			add_location(li0, file, 38, 4, 1265);
    			attr_dev(input2, "type", "checkbox");
    			attr_dev(input2, "id", "todo-2");
    			input2.checked = true;
    			add_location(input2, file, 69, 10, 2266);
    			attr_dev(label2, "for", "todo-2");
    			attr_dev(label2, "class", "todo-label");
    			add_location(label2, file, 70, 10, 2322);
    			attr_dev(div4, "class", "c-cb");
    			add_location(div4, file, 68, 8, 2237);
    			attr_dev(span11, "class", "visually-hidden");
    			add_location(span11, file, 77, 12, 2542);
    			attr_dev(button6, "type", "button");
    			attr_dev(button6, "class", "btn");
    			add_location(button6, file, 75, 10, 2478);
    			attr_dev(span12, "class", "visually-hidden");
    			add_location(span12, file, 81, 12, 2715);
    			attr_dev(button7, "type", "button");
    			attr_dev(button7, "class", "btn btn__danger");
    			add_location(button7, file, 79, 10, 2637);
    			attr_dev(div5, "class", "btn-group");
    			add_location(div5, file, 74, 8, 2444);
    			attr_dev(div6, "class", "stack-small");
    			add_location(div6, file, 67, 6, 2203);
    			attr_dev(li1, "class", "todo");
    			add_location(li1, file, 66, 4, 2179);
    			attr_dev(input3, "type", "checkbox");
    			attr_dev(input3, "id", "todo-3");
    			add_location(input3, file, 91, 10, 2950);
    			attr_dev(label3, "for", "todo-3");
    			attr_dev(label3, "class", "todo-label");
    			add_location(label3, file, 92, 10, 2998);
    			attr_dev(div7, "class", "c-cb");
    			add_location(div7, file, 90, 8, 2921);
    			attr_dev(span13, "class", "visually-hidden");
    			add_location(span13, file, 99, 12, 3224);
    			attr_dev(button8, "type", "button");
    			attr_dev(button8, "class", "btn");
    			add_location(button8, file, 97, 10, 3160);
    			attr_dev(span14, "class", "visually-hidden");
    			add_location(span14, file, 103, 12, 3403);
    			attr_dev(button9, "type", "button");
    			attr_dev(button9, "class", "btn btn__danger");
    			add_location(button9, file, 101, 10, 3325);
    			attr_dev(div8, "class", "btn-group");
    			add_location(div8, file, 96, 8, 3126);
    			attr_dev(div9, "class", "stack-small");
    			add_location(div9, file, 89, 6, 2887);
    			attr_dev(li2, "class", "todo");
    			add_location(li2, file, 88, 4, 2863);
    			attr_dev(ul, "role", "list");
    			attr_dev(ul, "class", "todo-list stack-large");
    			attr_dev(ul, "aria-labelledby", "list-heading");
    			add_location(ul, file, 36, 2, 1148);
    			add_location(hr, file, 110, 2, 3543);
    			attr_dev(button10, "type", "button");
    			attr_dev(button10, "class", "btn btn__primary");
    			add_location(button10, file, 114, 4, 3604);
    			attr_dev(button11, "type", "button");
    			attr_dev(button11, "class", "btn btn__primary");
    			add_location(button11, file, 115, 4, 3674);
    			attr_dev(div10, "class", "btn-group");
    			add_location(div10, file, 113, 2, 3576);
    			attr_dev(div11, "class", "todoapp stack-large");
    			add_location(div11, file, 1, 0, 22);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div11, anchor);
    			append_dev(div11, form0);
    			append_dev(form0, h20);
    			append_dev(h20, label0);
    			append_dev(form0, t1);
    			append_dev(form0, input0);
    			append_dev(form0, t2);
    			append_dev(form0, button0);
    			append_dev(div11, t4);
    			append_dev(div11, div0);
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
    			append_dev(div11, t22);
    			append_dev(div11, h21);
    			append_dev(div11, t24);
    			append_dev(div11, ul);
    			append_dev(ul, li0);
    			append_dev(li0, div3);
    			append_dev(div3, form1);
    			append_dev(form1, div1);
    			append_dev(div1, label1);
    			append_dev(div1, t26);
    			append_dev(div1, input1);
    			append_dev(form1, t27);
    			append_dev(form1, div2);
    			append_dev(div2, button4);
    			append_dev(button4, t28);
    			append_dev(button4, span9);
    			append_dev(div2, t30);
    			append_dev(div2, button5);
    			append_dev(button5, t31);
    			append_dev(button5, span10);
    			append_dev(ul, t33);
    			append_dev(ul, li1);
    			append_dev(li1, div6);
    			append_dev(div6, div4);
    			append_dev(div4, input2);
    			append_dev(div4, t34);
    			append_dev(div4, label2);
    			append_dev(div6, t36);
    			append_dev(div6, div5);
    			append_dev(div5, button6);
    			append_dev(button6, t37);
    			append_dev(button6, span11);
    			append_dev(div5, t39);
    			append_dev(div5, button7);
    			append_dev(button7, t40);
    			append_dev(button7, span12);
    			append_dev(ul, t42);
    			append_dev(ul, li2);
    			append_dev(li2, div9);
    			append_dev(div9, div7);
    			append_dev(div7, input3);
    			append_dev(div7, t43);
    			append_dev(div7, label3);
    			append_dev(div9, t45);
    			append_dev(div9, div8);
    			append_dev(div8, button8);
    			append_dev(button8, t46);
    			append_dev(button8, span13);
    			append_dev(div8, t48);
    			append_dev(div8, button9);
    			append_dev(button9, t49);
    			append_dev(button9, span14);
    			append_dev(div11, t51);
    			append_dev(div11, hr);
    			append_dev(div11, t52);
    			append_dev(div11, div10);
    			append_dev(div10, button10);
    			append_dev(div10, t54);
    			append_dev(div10, button11);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div11);
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

    function instance($$self, $$props) {
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Todos> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Todos", $$slots, []);
    	return [];
    }

    class Todos extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Todos",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    /* src/App.svelte generated by Svelte v3.24.1 */

    function create_fragment$1(ctx) {
    	let todos;
    	let current;
    	todos = new Todos({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(todos.$$.fragment);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			mount_component(todos, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(todos.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(todos.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(todos, detaching);
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
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("App", $$slots, []);
    	$$self.$capture_state = () => ({ Todos });
    	return [];
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
