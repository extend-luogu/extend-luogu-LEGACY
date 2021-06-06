// ==UserScript==
// @name           extend-luogu
// @namespace      http://tampermonkey.net/
// @version        5.5.6
// @description    Make Luogu more powerful.
// @author         optimize_2 ForkKILLET minstdfx haraki swift-zym qinyihao
// @match          https://*.luogu.com.cn/*
// @match          https://*.luogu.org/*
// @match          https://service-ig5px5gh-1305163805.sh.apigw.tencentcs.com/release/APIGWHtmlDemo-1615602121
// @match          https://service-psscsax9-1305163805.sh.apigw.tencentcs.com/release/exlg-version
// @match          https://www.bilibili.com/robots.txt?*
// @match          http://localhost/*
// @require        https://cdn.luogu.com.cn/js/jquery-2.1.1.min.js
// @require        https://cdn.bootcdn.net/ajax/libs/js-xss/0.3.3/xss.min.js
// @require        https://cdn.bootcdn.net/ajax/libs/marked/2.0.1/marked.min.js
// @grant          GM_addStyle
// @grant          GM_getValue
// @grant          GM_setValue
// @grant          GM_xmlhttpRequest
// @grant          unsafeWindow
// @connect        localhost
// ==/UserScript==

// ==Utilities==

const uindow = unsafeWindow
const $ = jQuery
const $$ = jQuery
const mdp = uindow.markdownPalettes
const log = (...s) => uindow.console.log("%c[exlg]", "color: #0e90d2;", ...s)
const warn = (...s) => uindow.console.warn("%c[exlg]", "color: #0e90d2;", ...s)
const error = (...s) => {
    uindow.console.error("%c[exlg]", "color: #0e90d2;", ...s)
    throw Error(s.join(" "))
}
const xss = new filterXSS.FilterXSS({
    onTagAttr: (_, k, v, __) => {
        if (k === "style") return `${k}="${v}"`
    }
})

Date.prototype.format = function (f, UTC) {
    UTC = UTC ? "UTC" : ""
    const re = {
        "y+": this[`get${UTC}FullYear`](),
        "m+": this[`get${UTC}Month`]() + 1,
        "d+": this[`get${UTC}Date`](),
        "H+": this[`get${UTC}Hours`](),
        "M+": this[`get${UTC}Minutes`](),
        "S+": this[`get${UTC}Seconds`](),
        "s+": this[`get${UTC}Milliseconds`]()
    }
    for (const r in re) if (RegExp(`(${r})`).test(f))
        f = f.replace(RegExp.$1,
            ("000" + re[r]).substr(re[r].toString().length + 3 - RegExp.$1.length)
        )
    return f
}

const version_cmp = (v1, v2) => {
    const op = (x1, x2) => x1 === x2 ? "==" : x1 < x2 ? "<<" : ">>"
    const exs = [ "pre", "alpha", "beta" ]

    const [ [ n1, e1 ], [ n2, e2 ] ] = [ v1, v2 ].map(v => v.split(" "))
    if (n1 === n2) return op(...[ e1, e2 ].map(e => e ? exs.findIndex(ex => ex === e) : Infinity))

    const [ m1, m2 ] = [ n1, n2 ].map(n => n.split("."))
    for (const [ k2, m ] of m1.entries())
        if (m !== m2[k2]) return op(+ m || 0, + m2[k2] || 0)
}

const lg_content = (url, cb) => {
    $.get(url + (url.includes("?") ? "&" : "?") + "_contentOnly=1", res => {
        if (res.code !== 200) error(`Requesting failure code: ${ res.code }.`)
        cb(res)
    })
}

const lg_alert = msg => uindow.show_alert("exlg 提醒您", msg)
const exlg_update_log = msg => uindow.show_alert("extend-luogu Ver. ${ GM_info.script.version } 更新日志", msg)

// ==Modules==

const mod = {
    _: [],

    reg: (name, info, path, func, styl) => mod._.push({
        name, info, path: Array.isArray(path) ? path : [ path ], func, styl
    }),
    reg_main: (name, info, path, func, styl) =>
        mod.reg("@" + name, info, path, () => (func(), false), styl),
    reg_user_tab: (name, info, tab, vars, func, styl) =>
        // FIXME: this seems not to work when the tab loads slowly.
        mod.reg(
            name, info, [ "@/user/*" ],
            () => {
                const $tabs = $(".items")
                const work = () => {
                    if ((location.hash || "#main") !== "#" + tab) return
                    log(`Working user tab#${tab} mod: "${name}"`)
                    func(typeof vars === "function" ? vars() : vars)
                }
                $tabs.on("click", work)
                work()
            }, styl
        ),
    reg_chore: (name, info, period, path, func, styl) => {
        if (typeof period === "string") {
            const num = + period.slice(0, -1), unit = {
                s: 1000,
                m: 1000 * 60,
                h: 1000 * 60 * 60,
                D: 1000 * 60 * 60 * 24
            }[ period.slice(-1) ]
            if (! isNaN(num) && unit) period = num * unit
            else error(`Parsing period failed: "${period}"`)
        }
        mod.reg(
            "^" + name, info, path, named => {
                const rec = GM_getValue("mod-chore-rec") ?? {}
                const last = rec[name], now = Date.now()

                let nostyl = true
                if (named || ! last || now - last > period) {
                    func()
                    if (nostyl) {
                        GM_addStyle(styl)
                        nostyl = false
                    }
                    rec[name] = Date.now()
                    GM_setValue("mod-chore-rec", rec)
                }
                else log(`Pending chore: "${name}"`)
            }
        )
    },
    reg_board: (name, info, func, styl) => mod.reg(
        name, info, "@/",
        () => {
            let $board = $("#exlg-board")
            if (! $board.length) $board = $(`
<div class="lg-article" id="exlg-board"><h2>exlg</h2></div> <br />
`).prependTo(".lg-right.am-u-md-4")
            func($(`<div></div><br>`).appendTo($board))
        }, styl
    ),
    find: name => mod._.find(m => m.name === name),
    find_i: name => mod._.findIndex(m => m.name === name),

    disable: name => { mod.find(name).on = false },
    enable: name => { mod.find(name).on = true },

    execute: name => {
        const exe = (m, named) => {
            if (! m) error(`Executing named mod but not found: "${name}"`)
            if (m.styl) GM_addStyle(m.styl)
            log(`Executing ${ named ? "named " : "" }mod: "${m.name}"`)
            return m.func(named)
        }
        if (name) {
            const m = mod.find(name)
            return exe(m, true)
        }

        mod.map = GM_getValue("mod-map")
        const map_init = mod.map ? false : (mod.map = {})
        for (const m of mod._)
            m.on = map_init ? (mod.map[ m.name ] = true) : mod.map[ m.name ]
        for (const m of mod._) {
            const pn = location.pathname
            if (m.on && m.path.some((p, _, __, pr = p.replace(/^[a-z]*?@.*?(?=\/)/, "")) => (
                p.startsWith("@/") && location.host === "www.luogu.com.cn" ||
                p.startsWith("@bili/") && location.host === "www.bilibili.com" ||
                p.startsWith("@cdn/") && location.host === "cdn.luogu.com.cn" ||
                p.startsWith("@tcs1/") && location.host === "service-ig5px5gh-1305163805.sh.apigw.tencentcs.com" ||
                p.startsWith("@tcs2/") && location.host === "service-psscsax9-1305163805.sh.apigw.tencentcs.com"
            ) && (
                p.endsWith("*") && pn.startsWith(pr.slice(0, -1)) ||
                pn === pr
            )))
                if (exe(m) === false) return
        }

        if (map_init) GM_setValue("mod-map", mod.map)
    }
}

mod.reg_main("springboard", "跨域跳板", "@bili/robots.txt", () => {
    const q = new URLSearchParams(location.search)
    if (q.has("benben")) {
        document.write(`<iframe src="https://service-ig5px5gh-1305163805.sh.apigw.tencentcs.com/release/APIGWHtmlDemo-1615602121"></iframe>`)
        uindow.addEventListener("message", e => {
            e.data.unshift("benben")
            uindow.parent.postMessage(e.data, "*")
        })
    }
    else if (q.has("update")) {
        document.write(`<iframe src="https://service-psscsax9-1305163805.sh.apigw.tencentcs.com/release/exlg-version"></iframe>`)
        uindow.addEventListener("message", e => {
            e.data.unshift("update")
            uindow.parent.postMessage(e.data, "*")
        })
    }
    else if (q.has("url")) {
        const url = q.get("url")
        if (confirm(`是否加载来自 ${url} 的页面？`))
            document.body.innerHTML = `<iframe src="${url}"></iframe>`
    }
}, `
iframe {
    border: none;
    display: block;
    width: 100%;
    height: 100%;
}
iframe::-webkit-scrollbar {
    display: none;
}
`)

mod.reg_main("benben-data", "犇犇数据", "@tcs1/release/APIGWHtmlDemo-1615602121", () =>
    uindow.parent.postMessage(JSON.parse(document.body.innerText), "*")
)

mod.reg_main("version-data", "版本数据", "@tcs2/release/exlg-version", () =>
    uindow.parent.postMessage([ document.body.innerText ], "*")
)

mod.reg("dash", "控制面板", "@/*", () => {
    const $dash = $(`<div id="exlg-dash">exlg</div>`).prependTo($("nav.user-nav, div.user-nav > nav"))
    const $win = $(`
<span id="exlg-dash-window">
    <p>
        <b>版本</b> <a id="exlg-dash-version-update">检查更新</a> <br />
        <a href="https://github.com/optimize-2/extend-luogu">GitHub</a> |
        <a href="https://github.com/optimize-2/extend-luogu/raw/main/extend-luogu.user.js">Raw</a> |
        <a href="https://hub.fastgit.org/optimize-2/extend-luogu/raw/main/extend-luogu.user.js">FastGit</a>
        <br />
        <a href="https://cdn.jsdelivr.net/gh/optimize-2/extend-luogu@latest/extend-luogu.user.js">JsDelivr</a>
        <i class="exlg-icon exlg-info" name="一键更新"></i>
        <br />
        <span id="exlg-dash-verison">${ GM_info.script.version }</span>
    </p>
    <p>
        <b>模块管理</b> <br />
        <a id="exlg-dash-mods-save">保存</a>
        <i class="exlg-icon exlg-info" name="刷新后生效"></i></span>
        <ul id="exlg-dash-mods"></ul>
    </p>
    <p>
        <b>关于</b> <br />
        <a href="https://www.luogu.com.cn/team/33255">官方团队 33255</a> <br />
        <a href="https://qm.qq.com/cgi-bin/qm/qr?k=ODbPTKWbZfGq3ll3yBfjdDKWDPhJhlX4&jump_from=webapi">QQ群 817265691</a> <br />
    </p>
</span>
    `)
        .appendTo($dash)
        .on("click", e => e.stopPropagation())
    $(`<i class="exlg-icon exlg-warn"></i>`).hide().appendTo($dash)

    const $mods = $("#exlg-dash-mods")
    mod._.forEach(m => {
        const $m = $(`
<li>
    <input type="checkbox" />
    ${ m.name } <br/>
    <i>${ m.info }</i>
</li>
        `)
            .appendTo($mods)
        $m.children("input")
            .prop("checked", m.on).prop("disabled", m.name === "dash")
            .on("change", () => {
                mod.map[ m.name ] = ! mod.map[ m.name ]
            })
    })
    $("#exlg-dash-mods-save").on("click", () => GM_setValue("mod-map", mod.map))
    $("#exlg-dash-version-update").on("click", () => mod.execute("^update"))

    $dash.on("click", _ => $win.toggle())
}, `
/* dash */
#exlg-dash {
    position: relative;
    display: inline-block;
    padding: 1px 10px 3px;
    background-color: cornflowerblue;
    color: white;
    border-radius: 6px;
    box-shadow: 0 0 7px dodgerblue;
}
#exlg-dash-window {
    position: absolute;
    top: 35px;
    left: 0px;
    z-index: 65536;
    display: none;
    overflow-y: scroll;
    width: 250px;
    height: 600px;
    padding: 5px;
    background: white;
    color: black;
    border-radius: 7px;
    box-shadow: rgb(187 227 255) 0px 0px 7px;
}
#exlg-dash-mods {
    list-style: none;
    padding: 0;
}
#exlg-dash > .exlg-warn {
    position: absolute;
    top: -.5em;
    right: -.5em;
}
/* global */
.exlg-icon::before {
    display: inline-block;
    width: 1.3em;
    height: 1.3em;
    margin-left: 3px;
    text-align: center;
    border-radius: 50%;
}
.exlg-icon:hover::after {
    display: inline-block;
}
.exlg-icon::after {
    display: none;
    content: attr(name);
    margin-left: 5px;
    padding: 0 3px;
    background-color: white;
    box-shadow: 0 0 7px deepskyblue;
    border-radius: 7px;
}
.exlg-icon.exlg-info::before {
    content: "i";
    color: white;
    background-color: deepskyblue;
    font-style: italic;
}
.exlg-icon.exlg-warn::before {
    content: "!";
    color: white;
    background-color: rgb(231, 76, 60);
    font-style: normal;
}
`)

mod.reg("emoticon", "表情输入", [ "@/discuss/lists", "@/discuss/show/*" ], () => {
    /*
    const emo = [
        [ "62224", [ "qq" ] ],
        [ "62225", [ "cy" ] ],
        [ "62226", [ "kel", "kl" ] ],
        [ "62227", [ "kk" ] ],
        [ "62228", [ "dk" ] ],
        [ "62230", [ "xyx", "hj" ] ],
        [ "62234", [ "jk" ] ],
        [ "62236", [ "qiang", "up", "+", "zan" ] ],
        [ "62238", [ "ruo", "dn", "-", "cai" ] ],
        [ "62239", [ "ts" ] ],
        [ "62240", [ "yun" ] ],
        [ "62243", [ "yiw", "yw", "?" ] ],
        [ "62244", [ "se", "*" ] ],
        [ "62246", [ "px" ] ],
        [ "62248", [ "wq" ] ],
        [ "62250", [ "fad", "fd" ] ],
        [ "69020", [ "youl", "yl" ] ]
    ]
    const emo_url = id => `https://cdn.luogu.com.cn/upload/pic/${id}.png`
    */
    const emo = [
        "qq",
        "cy",
        "kel",
        "dk",
        "kk",
        "xyx",
        "jk",
        "ts",
        "yun",
        "yiw",
        "se",
        "px",
        "wq",
        "fad",
        "xia",
        "jy",
        "qiao",
        "youl",
        "qiang",
        "ruo",
        "shq",
        "mg",
        "dx",
        "tyt",
    ]
    const emo_url = name => `https://xn--9zr.tk/${name}`
    const $menu = $(".mp-editor-menu"),
        $txt = $(".CodeMirror-wrap textarea"),
        $nl = $("<br />").appendTo($menu),
        $grd = $(".mp-editor-ground").addClass("exlg-ext")

    emo.forEach(m => {
        const url = emo_url(m)
        $(`<li class="exlg-emo"><img src="${url}" /></li>`)
            .on("click", () => $txt
                .trigger("focus")
                .val(`![${ m[1][0] }](${url})`)
                .trigger("input")
            )
            .appendTo($menu)
    })
    const $emo = $(".exlg-emo")

    const $fold = $(`<li>表情 <i class="fa fa-chevron-left"></li>`)
        .on("click", () => {
            $nl.toggle()
            $emo.toggle()
            $fold.children().toggleClass("fa-chevron-left fa-chevron-right")
            $grd.toggleClass("exlg-ext")
        })
    $nl.after($fold)

    $txt.on("input", e => {
        if (e.originalEvent.data === "/")
            mdp.content = mdp.content.replace(/\/(.{1,5})\//g, (_, emo_txt) =>
                `![${emo_txt}](` + emo_url(emo.find(m => m.includes(emo_txt))) + `)`
            )
    })
}, `
.mp-editor-ground.exlg-ext {
    top: 80px !important;
}
.mp-editor-menu > br ~ li {
    position: relative;
    display: inline-block;
    margin: 0;
    padding: 5px 1px;
}
`)

mod.reg_chore("update", "脚本升级", "1D", "@/*", () => {
    let loaded = false
    if (loaded) $("#exlg-benben").attr("src", $("#exlg-benben").attr("src"))
    else {
        const $sb = $(`<iframe id="exlg-update" src="https://www.bilibili.com/robots.txt?update"></iframe>`)
            .appendTo($("body")).hide()
        log("Building springboard:", $sb[0])
        loaded = true
    }
    uindow.addEventListener("message", e => {
        log("Listening message:", e.data)
        if (e.data[0] !== "update") return
        e.data.shift()

        const
            latest = e.data[0],
            version = GM_info.script.version,
            op = version_cmp(version, latest)

        const l = `Comparing version: ${version} ${op} ${latest}`
        log(l)

        if (op === "<<") $("#exlg-dash > .exlg-warn").show()
        $("#exlg-dash-verison").html(l.split(": ")[1]
            .replace(">>", `<span style="color: #5eb95e;">&gt;&gt;</span>`)
            .replace("==", `<span style="color: #5eb95e;">==</span>`)
            .replace("<<", `<span style="color: #e74c3c;">&lt;&lt;</span>`)
        )
    })
})

mod.reg_user_tab("user-intro-ins", "主页指令", "main", null, () => {
    $(".introduction > *").each((_, e, $e = $(e)) => {
        const t = $e.text()
        let [ , , ins, arg ] = t.match(/^(exlg.|%)([a-z]+):([^]+)$/) ?? []
        if (! ins) return

        arg = arg.split(/(?<!!)%/g).map(s => s.replace(/!%/g, "%"))
        const $blog = $($(".user-action").children()[0])
        switch (ins) {
        case "html":
            $e.replaceWith($(`<p>${ xss.process(arg[0]) }</p>`))
            break
        case "frame":
            $e.replaceWith($(`<iframe src="https://www.bilibili.com/robots.txt?url=${ encodeURI(arg[0]) }"`
                + `style="width: ${ arg[1] }; height: ${ arg[2] };"></iframe>`
            ))
            break
        case "blog":
            if ($blog.text().trim() !== "个人博客") return
            $blog.attr("href", arg)
            $e.remove()
            break
        }
    })
}, `
iframe {
    border: none;
    display: block;
}
iframe::-webkit-scrollbar {
    display: none;
}
`)

mod.reg_user_tab("user-problem", "题目颜色和比较", "practice", () => ({
    color: [
        "rgb(191, 191, 191)",
        "rgb(254, 76, 97)",
        "rgb(243, 156, 17)",
        "rgb(255, 193, 22)",
        "rgb(82, 196, 26)",
        "rgb(52, 152, 219)",
        "rgb(157, 61, 207)",
        "rgb(14, 29, 105)"
    ]
}), ({ color }) => {
    $(".exlg-counter").remove()
    $(".problems").each((i, ps, $ps = $(ps)) => {
        const my = uindow._feInjection.currentData[ [ "submittedProblems", "passedProblems" ][i] ]
        $ps.find("a").each((d, p, $p = $(p)) =>
            $p.removeClass("color-default").css("color", color[ my[d].difficulty ])
        )
        $ps.before($(`<span id="exlg-problem-count-${i}" class="exlg-counter">${ my.length }</span>`))
    })

    if (uindow._feInjection.currentData.user.uid === uindow._feInjection.currentUser.uid) return

    lg_content(`/user/${ uindow._feInjection.currentUser.uid }`, res => {
        const my = res.currentData.passedProblems
        const ta = uindow._feInjection.currentData.passedProblems

        let same = 0
        const $ps = $($(".problems")[1])
        $ps.find("a").each((d, p, $p = $(p)) => {
            if (my.some(m => m.pid === ta[d].pid)) {
                same ++
                $p.css("backgroundColor", "rgba(82, 196, 26, 0.3)")
            }
        })
        $("#exlg-problem-count-1").html(`<span class="exlg-counter">${ ta.length } <> ${ my.length } : ${same}`
            + `<i class="exlg-icon exlg-info" name="ta 的 &lt;&gt; 我的 : 相同"></i></span>`)
    })
}, `
.main > .card > h3 {
    display: inline-block;
}
`)

mod.reg("user-css-load", "加载用户样式", "@/*", () => {}, GM_getValue("user-css"))
mod.reg("user-css-edit", "编辑用户样式", "@/theme/list", () => {
    const $ps = $(`
<div id="exlg-user-css">
    <h2>自定义 CSS <a>保存刷新</a></h2>
    <textarea/>
</div>
`)
        .appendTo(".full-container")
    const $t = $ps.children("textarea").val(GM_getValue("user-css"))
    $ps.find("a").on("click", () => {
        GM_setValue("user-css", $t.val())
        location.reload()
    })
}, `
#exlg-user-css {
    display: block;
    box-sizing: border-box;
    padding: 1.3em;
    margin-bottom: 1.3em;
    background-color: white;
    box-shadow: 0 0 7px dodgerblue;
}
#exlg-user-css a {
    font-weight: normal;
    font-size: 20px;
}
#exlg-user-css > textarea {
    width: 100%;
    min-height: 100px;
}
`)

mod.reg("benben", "全网犇犇", "@/", () => {
    const color = {
        Gray: "gray",
        Blue: "bluelight",
        Green: "green",
        Orange: "orange lg-bold",
        Red: "red lg-bold",
        Purple: "purple lg-bold",
    }
    const check_svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="%" style="margin-bottom: -3px;">
    <path d="M16 8C16 6.84375 15.25 5.84375 14.1875 5.4375C14.6562 4.4375 14.4688 3.1875 13.6562 2.34375C12.8125 1.53125 11.5625 1.34375 10.5625 1.8125C10.1562 0.75 9.15625 0 8 0C6.8125 0 5.8125 0.75 5.40625 1.8125C4.40625 1.34375 3.15625 1.53125 2.34375 2.34375C1.5 3.1875 1.3125 4.4375 1.78125 5.4375C0.71875 5.84375 0 6.84375 0 8C0 9.1875 0.71875 10.1875 1.78125 10.5938C1.3125 11.5938 1.5 12.8438 2.34375 13.6562C3.15625 14.5 4.40625 14.6875 5.40625 14.2188C5.8125 15.2812 6.8125 16 8 16C9.15625 16 10.1562 15.2812 10.5625 14.2188C11.5938 14.6875 12.8125 14.5 13.6562 13.6562C14.4688 12.8438 14.6562 11.5938 14.1875 10.5938C15.25 10.1875 16 9.1875 16 8ZM11.4688 6.625L7.375 10.6875C7.21875 10.8438 7 10.8125 6.875 10.6875L4.5 8.3125C4.375 8.1875 4.375 7.96875 4.5 7.8125L5.3125 7C5.46875 6.875 5.6875 6.875 5.8125 7.03125L7.125 8.34375L10.1562 5.34375C10.3125 5.1875 10.5312 5.1875 10.6562 5.34375L11.4688 6.15625C11.5938 6.28125 11.5938 6.5 11.4688 6.625Z"></path>
</svg>`
    const check = lv => lv <= 3 ? "" : check_svg.replace("%", lv <= 5 ? "#5eb95e" : lv <= 8 ? "#3498db" : "#f1c40f")

    let loaded = false

    const $sel = $(".feed-selector")
    $(`<li class="feed-selector" id="exlg-benben-selector" data-mode="all"><a style="cursor: pointer">全网动态</a></li>`)
        .appendTo($sel.parent())
        .on("click", e => {
            const $this = $(e.currentTarget)
            $sel.removeClass("am-active")
            $this.addClass("am-active")

            $("#feed-more").hide()
            $("li.am-comment").remove()

            if (loaded) $("#exlg-benben").attr("src", $("#exlg-benben").attr("src"))
            else {
                const $sb = $(`<iframe id="exlg-benben" src="https://www.bilibili.com/robots.txt?benben"></iframe>`)
                    .appendTo($("body")).hide()
                log("Building springboard:", $sb[0])
                loaded = true
            }
        })

    uindow.addEventListener("message", e => {
        log("Listening message:", e.data)

        if (e.data[0] !== "benben") return
        e.data.shift()
        e.data.forEach(m =>
            $(`
<li class="am-comment am-comment-primary feed-li">
    <div class="lg-left">
        <a href="/user/${ m.user.uid }" class="center">
            <img src="https://cdn.luogu.com.cn/upload/usericon/${ m.user.uid }.png" class="am-comment-avatar">
        </a>
    </div>
    <div class="am-comment-main">
        <header class="am-comment-hd">
            <div class="am-comment-meta">
                <span class="feed-username">
                    <a class="lg-fg-${ color[m.user.color] }" href="/user/${ m.user.uid }" target="_blank">
                        ${ m.user.name }
                    </a>
                    <a class="sb_amazeui" target="_blank" href="/discuss/show/142324">
                        ${ check(m.user.ccfLevel) }
                    </a>
                    ${ m.user.badge ? `<span class="am-badge am-radius lg-bg-${ color[m.user.color] }">${ m.user.badge }</span>` : "" }
                </span>
                ${ new Date(m.time * 1000).format("yyyy-mm-dd HH:MM") }
                <a name="feed-reply">回复</a>
            </div>
        </header>
        <div class="am-comment-bd">
            <span class="feed-comment">
                ${ marked(m.content) }
            </span>
        </div>
    </div>
</li>`)
                .appendTo($("ul#feed"))
                .find("a[name=feed-reply]").on("click", () =>
                    $("textarea")
                        .trigger("focus").val(` || @${ m.user.name } : ${ m.content }`)
                        .trigger("input")
                )
        )
    })
})

mod.reg_board("rand-problem-ex", "随机跳题ex", $board => {
    $("[name='gotorandom']").text("随机")
    const $start_rand = $(`<button class="am-btn am-btn-primary am-btn-sm" name="gotorandomex" id="gtrdex">随机ex</button>`)
    $start_rand.appendTo($("[name='gotorandom']").parent())
    $(`<div id="exlg-dash-0" class = "exlg-rand-settings">...</div><span id="exlg-dash-0-window" class="exlg-window"><p><ul id="exlg-rand-diffs"><h2>随机跳题ex</h2></ul></p></span>`).appendTo($("[name='gotorandom']").parent())
	//$("[name='gotorandom']").parent().parent().children('h2').html($(`<h2>问题跳转</h2><div id="exlg-dash-0" class = "exlg-rand-settings">...</div><span id="exlg-dash-0-window" class="exlg-window"><p><ul id="exlg-rand-diffs"><h2>随机跳题ex</h2></ul></p></span>`))
    const iLoveMinecraft = [0, 1, 2, 3, 4, 5, 6, 7]
    const iLoveTouhou = [0, 1, 2, 3, 4]
    const fackYouCCF = ["P", "CF", "SP", "AT", "UVA"]
    const difficulty_select = GM_getValue("mod-rand-difficulty", [0, 0, 0, 0, 0, 0, 0, 0])
    const source_select = GM_getValue("mod-rand-source", [0, 0, 0, 0, 0])
    const difficulty_html = [
        `<div id="exlg-dash-0" class = "exlg-difficulties exlg-color-red">入门</div>`,
        `<div id="exlg-dash-0" class = "exlg-difficulties exlg-color-orange">普及-</div>`,
        `<div id="exlg-dash-0" class = "exlg-difficulties exlg-color-yellow">普及/提高-</div>`,
        `<div id="exlg-dash-0" class = "exlg-difficulties exlg-color-green">普及+/提高</div>`,
        `<div id="exlg-dash-0" class = "exlg-difficulties exlg-color-blue">提高+/省选-</div>`,
        `<div id="exlg-dash-0" class = "exlg-difficulties exlg-color-purple">省选/NOI-</div>`,
        `<div id="exlg-dash-0" class = "exlg-difficulties exlg-color-black">NOI/NOI+/CTSC</div>`,
        `<div id="exlg-dash-0" class = "exlg-difficulties exlg-color-grey">暂无评定</div>`
    ]
    const source_html = [
        `<div id="exlg-dash-0" class = "exlg-difficulties exlg-color-red">洛谷题库</div>`,
        `<div id="exlg-dash-0" class = "exlg-difficulties exlg-color-orange">Codeforces</div>`,
        `<div id="exlg-dash-0" class = "exlg-difficulties exlg-color-yellow">SPOJ</div>`,
        `<div id="exlg-dash-0" class = "exlg-difficulties exlg-color-green">ATcoder</div>`,
        `<div id="exlg-dash-0" class = "exlg-difficulties exlg-color-blue">UVA</div>`
    ]
    const $diffs = $("#exlg-rand-diffs")
    $(`<h3>设置题目难度</h3>`).appendTo($diffs)
    iLoveMinecraft.forEach(i => {
        const $m = $(`
<li>
    <input type="checkbox" />
    ` + difficulty_html[i] + `<br/>
</li>
		`).appendTo($diffs)
        $m.children("input")
            .prop("checked", difficulty_select[i] == 1)
            .on("change", () => {
                difficulty_select[i] = !difficulty_select[i]
            })
    })
    $(`<h3>设置题目来源</h3>`).appendTo($diffs)
    iLoveTouhou.forEach(i => {
        const $m = $(`
<li>
    <input type="checkbox" />
    ` + source_html[i] + `<br/>
</li>
		`).appendTo($diffs)
        $m.children("input")
            .prop("checked", source_select[i] == 1)
            .on("change", () => {
                source_select[i] = !source_select[i]
            })
    })
    $(`<br>`).appendTo($diffs)
    const save_rdpb = $(`<button class="am-btn am-btn-primary am-btn-sm" name="saverandom">保存</button>`)
    save_rdpb.on("click", _ => {
        GM_setValue("mod-rand-difficulty", difficulty_select)
        GM_setValue("mod-rand-source", source_select)
        $("#exlg-dash-0-window").toggle()
    })
    save_rdpb.appendTo($diffs)
    $("#exlg-dash-0").on("click", _ => $("#exlg-dash-0-window").toggle())
    const HREF_NEXT = () => {
        //console.log("IAKIOI")
        let difs = []
        iLoveMinecraft.forEach(i => {
            if (difficulty_select[i] != 0) {
                if (i == 7) {
                    difs.push(0)
                }
                else difs.push(i + 1)
            }
        })
        if (difs.length == 0) {
            difs = [0, 1, 2, 3, 4, 5, 6, 7]
        }
        let srcs = []
        iLoveTouhou.forEach(i => {
            if (source_select[i] != 0) srcs.push(i)
        })
        if (srcs.length == 0) {
            srcs = [0]
        }
        const difficulty = difs[Math.floor(Math.random() * difs.length)]
        //["P","CF","SP","AT","UVA"]
        const source = fackYouCCF[srcs[Math.floor(Math.random() * srcs.length)]]
        lg_content(`/problem/list?difficulty=${difficulty}&type=${source}&page=1`,
            res => {
                const
                    problem_count = res.currentData.problems.count,
                    page_count = Math.ceil(problem_count / 50),
                    rand_page = Math.floor(Math.random() * page_count) + 1
                lg_content(`/problem/list?difficulty=${difficulty}&type=${source}&page=${rand_page}`,
                    res => {
                        const
                            list = res.currentData.problems.result,
                            rand_idx = Math.floor(Math.random() * list.length),
                            pid = list[rand_idx].pid
                        location.href = `/problem/${pid}`
                    }
                )
            }
        )
    }
    $("#gtrdex").on("click", HREF_NEXT)


    $("#rand-problem-2").on("click", () => {
        const id = $("[name=rand-problem-2]").val()
        lg_content(`/training/${id}`,
            res => {
                const
                    list = res.currentData.training.problems,
                    rand_idx = Math.floor(Math.random() * list.length),
                    pid = list[rand_idx].problem.pid
                location.href = `/problem/${pid}`
            }
        )
    })
},  `
#exlg-rand-diffs {
	list-style-type:none
}
.exlg-rand-settings {
    position: relative;
    display: inline-block;

    padding: 1px 5px 1px 5px;

    background-color: white;
	border: 1px solid #6495ED;
    color: cornflowerblue;
    border-radius: 6px;
    font-size:12px;
    float:right
}
.exlg-difficulties {
    position: relative;
    display: inline-block;
    padding: 1px 5px 1px;
    color: white;
    border-radius: 6px;
    font-size:1px;
}
.exlg-color-red {
	background-color: rgb(254, 76, 97)
}
.exlg-color-orange {
	background-color: rgb(243, 156, 17)
}
.exlg-color-yellow {
	background-color: rgb(255, 193, 22)
}
.exlg-color-green {
	background-color: rgb(82, 196, 26)
}
.exlg-color-blue {
	background-color: rgb(52, 152, 219)
}
.exlg-color-purple {
	background-color: rgb(157, 61, 207)
}
.exlg-color-black {
	background-color: rgb(14, 29, 105)
}
.exlg-color-grey {
	background-color: rgb(191, 191, 191)
}
.exlg-rand-settings:hover {
    box-shadow: 0 0 7px dodgerblue;
}
.exlg-window {
    position: absolute;
    top: 35px;
    left: 0px;
    z-index: 65536;
    display: none;
    overflow-y: scroll;
    width: 250px;
    height: 300px;
    padding: 5px;
    background: white;
    color: black;
    border-radius: 7px;
    box-shadow: rgb(187 227 255) 0px 0px 7px;
}
`)

mod.reg("keyboard-and-cli", "键盘操作与命令行", "@/*", () => {
    const $cli = $(`<div id="exlg-cli"></div>`).appendTo($("body"))
    const $cli_input = $(`<input id="exlg-cli-input" />`).appendTo($cli)

    let cli_is_log = false
    const cli_log = (sp, ...tp) => {
        cli_is_log = true
        const m = sp.map((s, i) =>
            s.split(/\b/).map(w => cli_lang_dict[w]?.[ cli_lang - 1 ] ?? w).join("") +
            (tp[i] || "")
        ).join("")
        return $cli_input.val(m)
    }
    const cli_error = (sp, ...tp) =>
        warn(cli_log(sp, ...tp).addClass("error").val())
    const cli_clean = () => {
        cli_is_log = false
        return $cli_input.val("").removeClass("error")
    }
    const cli_history = []
    let cli_history_index = 0
    const cli_langs = [ "en", "zh" ], cli_lang_dict = {
        ".": [ "。" ],
        ",": [ "，" ],
        "!": [ "！" ],
        "?": [ "？" ],
        "cli":        [ "命令行" ],
        "current":    [ "当前" ],
        "language":   [ "语言" ],
        "available":  [ "可用" ],
        "command":    [ "命令" ],
        "commands":   [ "命令" ],
        "unknown":    [ "未知" ],
        "forum":      [ "板块" ],
        "target":     [ "目标" ],
        "mod":        [ "模块" ],
        "action":     [ "操作" ],
        "illegal":    [ "错误" ],
        "param":      [ "参数" ],
        "expected":   [ "期望" ],
        "type":       [ "类型" ],
        "lost":       [ "缺失" ],
        "essential":  [ "必要" ],
        "user":       [ "用户" ]
    }
    let cli_lang = GM_getValue("cli-lang") || 0

    const cmds = {
        help: (cmd/*string*/) => {
            /* get the help of <cmd>. or list all cmds. */
            /* 获取 <cmd> 的帮助。空则列出所有。 */
            if (! cmd)
                cli_log`exlg cli. current language: ${cli_lang}, available commands: ${ Object.keys(cmds).join(", ") }`
            else {
                const f = cmds[cmd]
                if (! f) return cli_error`help: unknown command "${cmd}"`

                const arg = f.arg.map(a => {
                    const i = a.name + ": " + a.type
                    return a.essential ? `<${i}>` : `[${i}]`
                }).join(" ")
                cli_log`${cmd} ${arg} ${ f.help[cli_lang] }`
            }
        },
        cd: (path/*!string*/) => {
            /* jump to <path>, relative path is OK. */
            /* 跳转至 <path>，支持相对路径。 */
            let tar
            if (path[0] === "/") tar = path
            else {
                const pn = location.pathname.replace(/^\/+/, "").split("/")
                const pr = path.split("/")
                pr.forEach(d => {
                    if (d === ".") return
                    if (d === "..") pn.pop()
                    else pn.push(d)
                })
                tar = pn.join("/")
            }
            location.href = location.origin + "/" + tar.replace(/^\/+/, "")
        },
        cdd: (forum/*!string*/) => {
            /* jump to the forum named <forum> of discussion. use all the names you can think of. */
            /* 跳转至名为 <forum> 的讨论板块，你能想到的名字基本都有用。 */
            const tar = [
                [ "relevantaffairs",    "gs", "gsq",    "灌水", "灌水区",               "r", "ra" ],
                [ "academics",          "xs", "xsb",    "学术", "学术版",               "a", "ac" ],
                [ "siteaffairs",        "zw", "zwb",    "站务", "站务版",               "s", "sa" ],
                [ "problem",            "tm", "tmzb",   "灌水", "题目总版",             "p"       ],
                [ "service",            "fk", "fksqgd", "反馈", "反馈、申请、工单专版",      "se" ]
            ]
            forum = tar.find(ns => ns.includes(forum))?.[0]
            if (! tar) return cli_error`cdd: unknown forum "${forum}"`
            cmds.cd(`/discuss/lists?forumname=${forum}`)
        },
        cc: (name/*char*/) => {
            /* jump to [name], "h|p|c|r|d|i|m|n" stands for home|problem|record|discuss|I myself|message|notification. or jump home. */
            /* 跳转至 [name]，"h|p|c|r|d|i|m|n" 代表：主页|题目|评测记录|讨论|个人中心|私信|通知。空则跳转主页。 */
            name = name || "h"
            const tar = {
                h: "/",
                p: "/problem/list",
                c: "/contest/list",
                r: "/record/list",
                d: "/discuss/lists",
                i: "/user/" + uindow._feInjection.currentUser.uid,
                m: "/chat",
                n: "/user/notification",
            }[name]
            if (tar) cmds.cd(tar)
            else cli_error`cc: unknown target "${name}"`
        },
        mod: (action/*!string*/, name/*string*/) => {
            /* for <action> "enable|disable|toggle", opearte the mod named <name>. for <action> "save", save modification. */
            /* 当 <action> 为 "enable|disable|toggle"，对名为 <name> 的模块执行对应操作：启用|禁用|切换。当 <action> 为 "save"，保存修改。 */
            const i = mod.find_i(name)
            switch (action) {
            case "enable":
            case "disable":
            case "toggle":
                if (i < 0) return cli_error`mod: unknown mod "${name}"`
                const $mod = $($("#exlg-dash-mods").children()[i]).children()
                $mod.prop("checked", {
                    enable: () => true, disable: () => false, toggle: now => ! now
                }[action]($mod.prop("checked"))).trigger("change")
                break
            case "save":
                GM_setValue("mod-map", mod.map)
                break
            default:
                return cli_error`mod: unknown action "${action}"`
            }
        },
        dash: (action/*!string*/) => {
            /* for <action> "show|hide|toggle", opearte the exlg dashboard. */
            /* 当 <action> 为 "show|hide|toggle", 显示|隐藏|切换 exlg 管理面板。 */
            if (! [ "show", "hide", "toggle" ].includes(action))
                return cli_error`dash: unknown action "${action}"`
            $("#exlg-dash-window")[action]()
        },
        lang: (lang/*!string*/) => {
            /* for <lang> "en|zh" switch current cli language. */
            /* 当 <lang> 为 "en|zh"，切换当前语言。 */
            lang = cli_langs.indexOf(lang)
            if (lang < 0) return cli_error`lang: unknown language ${lang}`
            GM_setValue("cli-lang", cli_lang = lang)
        },
        uid: (uid/*!integer*/) => {
            /* jumps to homepage of user whose uid is <uid>. */
            /* 跳转至 uid 为 <uid> 的用户主页。 */
            location.href = `/user/${uid}`
        },
        un: (name/*!string*/) => {
            /* jumps to homepage of user whose username is like <name>. */
            /* 跳转至用户名与 <name> 类似的用户主页。 */
            $.get("/api/user/search?keyword=" + name, res => {
                if (! res.users[0])
                    cli_error`un: unknown user "${name}".`
                else
                    location.href = "/user/" + res.users[0].uid
            })
        }
    }
    for (const f of Object.values(cmds)) {
        [ , f.arg, f.help ] = f.toString().match(/^\((.*?)\) => {((?:\n +\/\*.+?\*\/)+)/)
        f.arg = f.arg.split(", ").map(a => {
            const [ , name, type ] = a.match(/([a-z_]+)\/\*(.+)\*\//)
            return {
                name, essential: type[0] === "!", type: type.replace(/^!/, "")
            }
        })
        f.help = f.help.trim().split("\n").map(s => s.match(/\/\* (.+) \*\//)[1])
    }
    const parse = cmd => {
        log(`Parsing command: "${cmd}"`)

        const tk = cmd.trim().replace(/^\//, "").split(" ")
        const n = tk.shift()
        if (! n) return
        const f = cmds[n]
        if (! f) return cli_error`exlg: unknown command "${n}"`
        let i = -1, a; for ([ i, a ] of tk.entries()) {
            const t = f.arg[i].type
            if (t === "number" || t === "integer") tk[i] = Number(a)
            if (
                t === "char" && a.length === 1 ||
                t === "number" && ! isNaN(tk[i]) ||
                t === "integer" && ! isNaN(tk[i]) && ! (tk[i] % 1) ||
                t === "string"
            ) ;
            else return cli_error`${n}: illegal param "${a}", expected type ${t}.`
        }
        if (f.arg[i + 1]?.essential) return cli_error`${n}: lost essential param "${ f.arg[i + 1].name }"`
        f(...tk)
    }

    $cli_input.on("keydown", e => {
        switch (e.key) {
        case "Enter":
            if (cli_is_log) return cli_clean()
            const cmd = $cli_input.val()
            cli_history.push(cmd)
            cli_history_index = cli_history.length
            parse(cmd)
            if (! cli_is_log) return cli_clean()
            break
        case "/":
            if (cli_is_log) cli_clean()
            break
        case "Escape":
            $cli.hide()
            break
        case "ArrowUp":
        case "ArrowDown":
            const i = cli_history_index + { ArrowUp: -1, ArrowDown: +1 }[ e.key ]
            if (i < 0 || i >= cli_history.length) return
            cli_history_index = i
            $cli_input.val(cli_history[i])
            break
        }
    })

    $(uindow).on("keydown", e => {
        const $act = $(document.activeElement)
        if ($act.is("body")) {
            const rel = { ArrowLeft: "prev", ArrowRight: "next" }[ e.key ]
            if (rel) return $(`a[rel=${rel}]`)[0].click()

            if (e.shiftKey) {
                const y = { ArrowUp: 0, ArrowDown: 1e6 }[ e.key ]
                if (y !== undefined) uindow.scrollTo(0, y)
            }

            if (e.key === "/") {
                $cli.show()
                cli_clean().trigger("focus")
            }
        }
        else if ($act.is("[name=captcha]") && e.key === "Enter")
            $("#submitpost, #submit-reply")[0].click()
    })
}, `
#exlg-cli {
    position: fixed;
    top: 0;
    z-index: 65536;
    display: none;
    width: 100%;
    height: 40px;
    background-color: white;
    box-shadow: 0 0 7px dodgerblue;
}
#exlg-cli-input {
    display: block;
    height: 100%;
    width: 100%;
    border: none;
    outline: none;
    font-family: "Fira Code", "consolas", "Courier New", monospace;
}
#exlg-cli-input.error {
    background-color: indianred;
}
`)


mod.reg("copy-code-block", "一键复制代码块", "@/*", () => {
    const $cb = $("pre:has(> code)")
    if ($cb.length) log(`Scanning code block:`, $cb.length)
	const language_show = GM_getValue("copy-code-block-language", 1)
    $cb.each((i, e, $e = $(e)) => {
        $(`<body><text>
</text></body>`).prependTo($cb[i])
        const btn = $(`<div class="exlg-copy">复制</div>`)
        const language_list = ['c', 'cpp', 'pascal', 'python', 'java', 'javascript', 'php', 'latex']
        let language = ""
		if (language_show) {
			if ($e.find("code").attr("data-rendered-lang")) {
				language = $e.find("code").attr("data-rendered-lang").toString()
			}
			if ($e.find("code").attr("class")) {
				const str = $e.find("code").attr("class").toString()
				if (str.indexOf("hljs") != -1) {
					language = str.substr(9, str.length - 14)
				}
				else {
					language = str.substr(9, str.length - 9)
				}
			}
			if (language.indexOf('ult language-') == 0) {
				language = language.substr(13)
			}
			if (language_list.indexOf(language) == -1) {
				language = ""
			}
			console.log(language_list.indexOf(language))
			if (language == "cpp") {
				language = "c++"
			}
			if (language != "") language = "-" + language
		}
        console.log("Language:" + language)
        btn.on("click", () => {
            const $textarea = $("<textarea></textarea>")
                .appendTo($("body"))
                .text($e.text().slice(6 + language.length))
                .select()
            btn.text("复制成功")
            setTimeout(() => btn.text("复制"), 1000)
            document.execCommand("copy")
            $textarea.remove()
        }).prependTo($cb[i])
        $(`<span style="font-size:15px;font-weight:bold">源代码${language}</span>`).prependTo($cb[i])
		if(!$cb.children('code').hasClass('hljs')) {
			$cb.children('code').addClass('hljs').css('background','white')//style="background: white"
		}
    })
}, `
.exlg-copy {
    position: relative;
    display: inline-block;

    padding: 1px 5px 1px 5px;

    background-color: white;
	border: 1px solid #6495ED;
    color: cornflowerblue;
    border-radius: 6px;
    font-size:12px;
    float:right
}
.exlg-copy:hover {
    box-shadow: 0 0 7px dodgerblue;
}
.copy-btn {
    font-size: .8em;
    float: right;
    padding: 0 5px;
}
.lfe-form-sz-middle {
    font-size: 0.875em;
    padding: 0.313em 1em;
}
`)

mod.reg_board("search-user", "查找用户名", $board => {
    $board.html(`
<h3>查找用户</h3>
<div class="am-input-group am-input-group-primary am-input-group-sm">
    <input type="text" class="am-form-field" placeholder="例：kkksc03，可跳转站长主页" name="username" id="search-user-input">
</div>
<p>
    <button class="am-btn am-btn-danger am-btn-sm" id="search-user">跳转</button>
</p>
`)
    const func = () => {
        $search_user.prop("disabled", true)
        $.get("/api/user/search?keyword=" + $("[name=username]").val(), res => {
            if (! res.users[0]) {
                $search_user.prop("disabled", false)
                lg_alert("无法找到指定用户")
            }
            else
                location.href = "/user/" + res.users[0].uid
        })
    }
    const $search_user = $("#search-user").on("click", func)
    $("#search-user-input").keydown((e) => { if (e.keyCode == 13) func() })
})

mod.reg("problem-export", "题目导出", "@/*", () => {
    if (!/\/problem\/(U|T|P|CF|AT|SP|UVA)[1-9]\d*$/.test(location.pathname)) {
        return
    }
    const btn = $(`
    <button data-v-370e72e2="" data-v-42c20b13="" type="button" class="lfe-form-sz-middle" data-v-52820d90=""
    style="border-color: rgb(52, 152, 219); background-color: rgb(52, 152, 219);">
    导出题目
    </button>
    `), submit_button = $("div").val("提交答案")
    const setbtn = ()=>{
        btn.on("click", () => {
        const defaultPorts = [
            1327, // cpbooster
            4244, // Hightail
            6174, // Mind Sport
            10042, // acmX
            10043, // Caide and AI Virtual Assistant
            10045, // CP Editor
            27121, // Competitive Programming Helper
        ]
        try {
            lg_content(window.location.pathname + window.location.search, res => {
                const problem = res.currentData.problem, contest = res.currentData.contest
                const exportData = {
                    name:problem.title,
                    group:contest ? contest.name : "题目列表",
                    url:window.location.href,
                    memoryLimit:Math.max(...problem.limits.memory) / 1024,
                    timeLimit:Math.max(...problem.limits.time),
                    tests:problem.samples.map(sample => {
                        return {
                            input:sample[0],
                            output:sample[1]
                        }
                    })
                }
                for (const port of defaultPorts) {
                    GM_xmlhttpRequest({
                        method: "POST",
                        url: `http://localhost:${port}`,
                        headers: {
                            "Content-Type": "application/json"
                        },
                        data:JSON.stringify(exportData)
                    })
                }
                alert("导出成功！")
            })
        }
        catch (e) {
            alert(`导出失败：${e}`)
        }
    })
    }
    btn.appendTo($("div.operation"))
    setbtn()
    let tap_number = 0
    submit_button.on("click", () => {
        tap_number += 1
        if (tap_number % 6 == 0) {
            btn.remove()
            btn.appendTo($("div.operation"))
            setbtn()
        }
    })
})

mod.reg("luogu-settings-extension", "洛谷风格扩展设置", "@/*", () => {
	//"https://www.luogu.com.cn/user/setting#extension"
	const href_list = ['information', 'preference', 'security', 'extension', 'extension-admin']
	if (window.location.href == "https://www.luogu.com.cn/user/setting#extension-hidden") {

	}
	else if (window.location.href == "https://www.luogu.com.cn/user/setting" || window.location.href.indexOf("https://www.luogu.com.cn/user/setting#") == 0) {
		if (window.location.href == "https://www.luogu.com.cn/user/setting" || href_list.indexOf(window.location.href.substr(38)) == -1) {
            console.log('23333')
			window.location.href = "https://www.luogu.com.cn/user/setting#information"
		}
		const html_circleon = `<svg data-v-2dc28d52="" aria-hidden="true" focusable="false" data-prefix="far" data-icon="dot-circle" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" class="fa-input svg-inline--fa fa-dot-circle fa-w-16"><path data-v-2dc28d52="" fill="currentColor" d="M256 56c110.532 0 200 89.451 200 200 0 110.532-89.451 200-200 200-110.532 0-200-89.451-200-200 0-110.532 89.451-200 200-200m0-48C119.033 8 8 119.033 8 256s111.033 248 248 248 248-111.033 248-248S392.967 8 256 8zm0 168c-44.183 0-80 35.817-80 80s35.817 80 80 80 80-35.817 80-80-35.817-80-80-80z" class=""></path></svg>`
		const html_circleoff = `<svg data-v-2dc28d52="" aria-hidden="true" focusable="false" data-prefix="far" data-icon="circle" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" class="fa-input svg-inline--fa fa-circle fa-w-16"><path data-v-2dc28d52="" fill="currentColor" d="M256 8C119 8 8 119 8 256s111 248 248 248 248-111 248-248S393 8 256 8zm0 448c-110.5 0-200-89.5-200-200S145.5 56 256 56s200 89.5 200 200-89.5 200-200 200z" class=""></path></svg>`
		const $lg_entry = $('.items').children('li')
		const $lg_form_layout = $('.padding-default')
	    $lg_entry.hide()
		const $ex_form_layout = $(`<div data-v-796309f8="" data-v-7765a18d="" class="card padding-default" id="exlg-padding" data-v-6febb0e8=""><div data-v-22efe7ee="" data-v-61c90fba="" data-v-7765a18d="" class="exlg-form-layout" data-v-796309f8=""></div></div>`).hide().appendTo($('.full-container'))
		const $ex_admin_form_layout = $(`<div data-v-796309f8="" data-v-7765a18d="" class="card padding-default" id="exlg-padding" data-v-6febb0e8=""><div data-v-22efe7ee="" data-v-61c90fba="" data-v-7765a18d="" class="exlg-admin-form-layout" data-v-796309f8=""></div></div>`).hide().appendTo($('.full-container'))
		//set the layout
		$(
`<div data-v-22efe7ee="" class="row">
	<span data-v-22efe7ee="">
		<span data-v-9a2394ca="" data-v-22efe7ee="">模块开关</span>
	</span><div data-v-22efe7ee=""><div data-v-9a2394ca="" data-v-22efe7ee="" id="ex-settings-module-switch">
		<p data-v-9a2394ca="" data-v-22efe7ee="" class="lfe-caption">设置exlg插件各模块的开启与关闭。</p>
	</div></div>
</div>`).appendTo($ex_form_layout)
		$(
`<div data-v-22efe7ee="" class="row">
	<span data-v-22efe7ee="">
		<span data-v-9a2394ca="" data-v-22efe7ee="">模块设置</span>
	</span><div data-v-22efe7ee=""><div data-v-9a2394ca="" data-v-22efe7ee="" id="ex-settings-module-settings">
		<p data-v-9a2394ca="" data-v-22efe7ee="" class="lfe-caption">设置exlg插件特定模块的功能。</p>
	</div></div>
</div>`).appendTo($ex_form_layout)
		$(
`<div data-v-22efe7ee="" class="row">
	<span data-v-22efe7ee="">
		<span data-v-9a2394ca="" data-v-22efe7ee="">高级设置</span>
	</span><div data-v-22efe7ee=""><div data-v-9a2394ca="" data-v-22efe7ee="" id="ex-settings-advanced-settings">
		<p data-v-9a2394ca="" data-v-22efe7ee="" class="lfe-caption">一些奇怪的东西。</p>
	</div></div>
</div>`).appendTo($ex_form_layout)


		//end.

		//set the admin layout.

		$(
`<div data-v-22efe7ee="" class="row">
	<span data-v-22efe7ee="">
		<span data-v-9a2394ca="" data-v-22efe7ee="">意见反馈</span>
	</span><div data-v-22efe7ee=""><div data-v-9a2394ca="" data-v-22efe7ee="" id="ex-settings-fuck-you">
		<p data-v-9a2394ca="" data-v-22efe7ee="" class="lfe-caption">一些奇怪的东西。</p>
	</div></div>
</div>`).appendTo($ex_admin_form_layout)
		$(
`<div data-v-22efe7ee="" class="row">
	<span data-v-22efe7ee="">
		<span data-v-9a2394ca="" data-v-22efe7ee="">版本&更新</span>
	</span><div data-v-22efe7ee=""><div data-v-9a2394ca="" data-v-22efe7ee="" id="ex-settings-update-versions">
		<p data-v-9a2394ca="" data-v-22efe7ee="" class="lfe-caption">一些奇怪的东西。</p>
	</div></div>
</div>`).appendTo($ex_admin_form_layout)
		$(
`<div data-v-22efe7ee="" class="row">
	<span data-v-22efe7ee="">
		<span data-v-9a2394ca="" data-v-22efe7ee="">实验性玩法</span>
	</span><div data-v-22efe7ee=""><div data-v-9a2394ca="" data-v-22efe7ee="" id="ex-settings-features-laboratory">
		<p data-v-9a2394ca="" data-v-22efe7ee="" class="lfe-caption">一些脑洞会先在这里测试。</p>
	</div></div>
</div>`).appendTo($ex_admin_form_layout)
		$(
`<div data-v-22efe7ee="" class="row">
	<span data-v-22efe7ee="">
		<span data-v-9a2394ca="" data-v-22efe7ee="">数据&调试</span>
	</span><div data-v-22efe7ee=""><div data-v-9a2394ca="" data-v-22efe7ee="" id="ex-settings-data-debug">
		<p data-v-9a2394ca="" data-v-22efe7ee="" class="lfe-caption">一些奇怪的东西。</p>
	</div></div>
</div>`).appendTo($ex_admin_form_layout)
		//end.
/*
		if (1) {
			let $btn_tmp = undefined
			if (GM_getValue('copy-code-block-language')) {
				$btn_tmp = $(html_circleon)
			}
			else {
				$btn_tmp = $(html_circleoff)
			}
			$btn_tmp.on("click", () => {
				if ($btn_tmp.hasClass('fa-dot-circle')) {
					$btn_tmp.html(html_circleoff)
					GM_setValue()
				}
				else {
					$btn_tmp.html(html_circleon)
				}
			})
			let $gsp = $('<label data-v-2dc28d52=""></label>')
			$gsp.append($btn_tmp)
			$gsp.append($('"' + title + '"'))
			return $gsp
		}*/

        const $ex_entry_info = $(`<li data-v-7092f3a4=""><span data-v-7092f3a4="" class="entry" id="exlg-new-settings-entry-info">个人信息</span><!----></li>`).appendTo($('.items'))
        const $ex_entry_pref = $(`<li data-v-7092f3a4=""><span data-v-7092f3a4="" class="entry" id="exlg-new-settings-entry-pref">使用偏好</span><!----></li>`).appendTo($('.items'))
        const $ex_entry_secu = $(`<li data-v-7092f3a4=""><span data-v-7092f3a4="" class="entry" id="exlg-new-settings-entry-secu">安全设置</span><!----></li>`).appendTo($('.items'))
        const $ex_entry_exte = $(`<li data-v-7092f3a4=""><span data-v-7092f3a4="" class="entry" id="exlg-new-settings-entry-exte">扩展设置</span><!----></li>`).appendTo($('.items'))
        const $ex_entry_admn = $(`<li data-v-7092f3a4=""><span data-v-7092f3a4="" class="entry" id="exlg-new-settings-entry-admn">高级设置</span><!----></li>`).appendTo($('.items'))
        const $ex_entry = [$ex_entry_info, $ex_entry_pref, $ex_entry_secu, $ex_entry_exte, $ex_entry_admn]
		$ex_entry[href_list.indexOf(window.location.href.substr(38))].children().addClass('selected')
		if (window.location.href.substr(38) == "extension") {
			$lg_form_layout.hide()
			$ex_form_layout.show()
			$ex_admin_form_layout.hide()
		}
		if (window.location.href.substr(38) == "extension-hidden") {
			$lg_form_layout.hide()
			$ex_form_layout.hide()
			$ex_admin_form_layout.show()
		}
		$ex_entry[0].on('click', () => {
			$lg_entry[0].click()
			$('.entry').removeClass('selected')
			$ex_entry[0].children().addClass('selected')
			$lg_form_layout.show()
			$ex_form_layout.hide()
			$ex_admin_form_layout.hide()
		})
		$ex_entry[1].on('click', () => {
			$lg_entry[1].click()
			$('.entry').removeClass('selected')
			$ex_entry[1].children().addClass('selected')
			$lg_form_layout.show()
			$ex_form_layout.hide()
			$ex_admin_form_layout.hide()
		})
		$ex_entry[2].on('click', () => {
			$lg_entry[2].click()
			$('.entry').removeClass('selected')
			$ex_entry[2].children().addClass('selected')
			$lg_form_layout.show()
			$ex_form_layout.hide()
			$ex_admin_form_layout.hide()
		})
		$ex_entry[3].on('click', () => {
			$('.entry').removeClass('selected')
			$ex_entry[3].children().addClass('selected')
			$lg_form_layout.hide()
			$ex_form_layout.show()
			$ex_admin_form_layout.hide()
			window.location.href = "https://www.luogu.com.cn/user/setting#extension"
		})
		$ex_entry[4].on('click', () => {
			$('.entry').removeClass('selected')
			$ex_entry[4].children().addClass('selected')
			$lg_form_layout.hide()
			$ex_form_layout.hide()
			$ex_admin_form_layout.show()
			window.location.href = "https://www.luogu.com.cn/user/setting#extension-hidden"
		})
	}



})

$(() => mod.execute())
log("Lauching")

Object.assign(uindow, {
    exlg: { mod, marked, log, error },
    $$: $, xss, version_cmp
})
