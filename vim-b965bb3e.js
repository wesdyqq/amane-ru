// Vim-style navigation for the book.
// j / k  - scroll down / up
// d / u  - half a page down / up
// gg / G - top / bottom
// h / l  - previous / next chapter
// /      - focus search
// ?      - help
(function () {
    "use strict";

    var SCROLL = 80;
    var pendingG = false;
    var pendingTimer = null;

    function isTyping(event) {
        var target = event.target;

        return (
            target instanceof HTMLElement &&
            (target.isContentEditable ||
                target.tagName === "INPUT" ||
                target.tagName === "TEXTAREA" ||
                target.tagName === "SELECT")
        );
    }

    function pageHeight() {
        return Math.max(
            document.body.scrollHeight,
            document.documentElement.scrollHeight
        );
    }

    function scrollBy(distance) {
        window.scrollBy({ top: distance, behavior: "smooth" });
    }

    function scrollTo(position) {
        window.scrollTo({ top: position, behavior: "smooth" });
    }

    function openChapter(selector) {
        var link = document.querySelector(selector);

        if (link && link.href) {
            window.location.href = link.href;
        }
    }

    function toggleHelp() {
        var help = document.getElementById("vim-help");

        if (help) {
            help.hidden = !help.hidden;
        }
    }

    function hideHelp() {
        var help = document.getElementById("vim-help");

        if (help) {
            help.hidden = true;
        }
    }

    function clearPendingG() {
        pendingG = false;

        if (pendingTimer !== null) {
            window.clearTimeout(pendingTimer);
            pendingTimer = null;
        }
    }

    document.addEventListener("keydown", function (event) {
        if (event.ctrlKey || event.altKey || event.metaKey || isTyping(event)) {
            return;
        }

        var key = event.key;

        if (pendingG) {
            clearPendingG();

            if (key === "g") {
                event.preventDefault();
                scrollTo(0);
                return;
            }
        }

        switch (key) {
            case "j":
                event.preventDefault();
                scrollBy(SCROLL);
                break;

            case "k":
                event.preventDefault();
                scrollBy(-SCROLL);
                break;

            case "d":
                event.preventDefault();
                scrollBy(window.innerHeight / 2);
                break;

            case "u":
                event.preventDefault();
                scrollBy(-window.innerHeight / 2);
                break;

            case "h":
                event.preventDefault();
                openChapter("a.nav-chapters.previous");
                break;

            case "l":
                event.preventDefault();
                openChapter("a.nav-chapters.next");
                break;

            case "G":
                event.preventDefault();
                scrollTo(pageHeight());
                break;

            case "g":
                pendingG = true;
                pendingTimer = window.setTimeout(clearPendingG, 800);
                break;

            case "/":
                var search = document.querySelector(
                    "#mdbook-searchbar, #searchbar"
                );

                if (search) {
                    event.preventDefault();
                    search.focus();
                }
                break;

            case "?":
                event.preventDefault();
                toggleHelp();
                break;

            case "Escape":
                hideHelp();
                break;
        }
    });

    document.addEventListener("DOMContentLoaded", function () {
        var hint = document.createElement("button");

        hint.id = "vim-hint";
        hint.type = "button";
        hint.title = "Vim-навигация (?)";
        hint.textContent = "hjkl";
        hint.addEventListener("click", toggleHelp);

        var help = document.createElement("div");

        help.id = "vim-help";
        help.hidden = true;
        help.innerHTML =
            "<b>Vim-навигация</b>" +
            "<table>" +
            "<tr><td><kbd>j</kbd> <kbd>k</kbd></td><td>прокрутка вниз / вверх</td></tr>" +
            "<tr><td><kbd>d</kbd> <kbd>u</kbd></td><td>полстраницы вниз / вверх</td></tr>" +
            "<tr><td><kbd>gg</kbd> <kbd>G</kbd></td><td>начало / конец страницы</td></tr>" +
            "<tr><td><kbd>h</kbd> <kbd>l</kbd></td><td>предыдущая / следующая глава</td></tr>" +
            "<tr><td><kbd>/</kbd></td><td>поиск по книге</td></tr>" +
            "<tr><td><kbd>?</kbd></td><td>показать или скрыть эту справку</td></tr>" +
            "</table>";

        document.body.appendChild(hint);
        document.body.appendChild(help);
    });
})();
