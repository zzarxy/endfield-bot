// Paste into the browser console on https://discordbotlist.com/bots/endfield-helper/edit
// Fills short/long description, invite link and FAQ from the bot site. Then pass the captcha and press "Edit".
(async () => {
  const L = await (await fetch("https://endfield-bot.endfield-bot.workers.dev/listing.json?v=" + Date.now())).json();
  const set = (el, v) => {
    const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const [shortTa, longTa] = document.querySelectorAll("textarea");
  set(shortTa, L.short);
  set(longTa, L.long);
  const invite = [...document.querySelectorAll("input[type=text]")].find((i) => i.value.includes("oauth2/authorize"));
  if (invite) set(invite, "https://discord.com/oauth2/authorize?client_id=1568475342174162947&scope=bot+applications.commands&permissions=3072");
  const addBtn = () => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Add Question");
  while (document.querySelectorAll('input[placeholder^="Question"]').length < L.faq.length) {
    addBtn().click();
    await new Promise((r) => setTimeout(r, 200));
  }
  const qs = document.querySelectorAll('input[placeholder^="Question"]');
  const as = document.querySelectorAll('input[placeholder^="Answer"]');
  L.faq.forEach((f, i) => { set(qs[i], f.q.slice(0, 60)); set(as[i], f.a.slice(0, 280)); });
  console.log("Filled. Now complete the captcha and press Edit.");
})();
