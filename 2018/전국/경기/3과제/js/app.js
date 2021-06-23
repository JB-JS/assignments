(function () {
  Date.prototype.ymdhms = function () {
    const zero = (n) => (n < 10 ? '0' + n : n);

    return `${this.getFullYear()}-${zero(this.getMonth() + 1)}-${zero(
      this.getDate()
    )} ${zero(this.getHours())}:${zero(this.getMinutes())}:${zero(
      this.getSeconds()
    )} `;
  };

  const dd = console.log.bind(console);
  const LS = window.localStorage;

  const List = {
    init() {
      if (!LS.getItem('webSite')) {
        LS.setItem(
          'webSite',
          JSON.stringify({
            idx: 0,
            list: [],
          })
        );
      }
      this.refresh();
    },
    refresh() {
      const { list } = JSON.parse(LS.getItem('webSite'));
      const $sort = $('#sort').val();
      const $order = $('#order').val();

      list.sort((a, b) => {
        let result = a[$sort] < b[$sort] ? -1 : 1;

        if (a[$sort] === b[$sort]) result = 0;

        if ($order === 'desc') result *= -1;

        return result;
      });

      $('.list').remove();

      list.forEach((v) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const image = new Image();

        canvas.width = 400;
        canvas.height = 225;

        image.onload = function () {
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, 400, 225);
          ctx.drawImage(image, 0, 0, 400, 225);
          $('.sibal[data-idx=' + v.idx + ']').attr('src', canvas.toDataURL());
        };

        let svgData = `<svg xmlns="http://www.w3.org/2000/svg" width="${v.width}" height="${v.height}">
            <foreignObject width="100%" height="100%">
              <div xmlns="http://www.w3.org/1999/xhtml" style="position:relative">
                ${v.html}
              </div>
            </foreignObject>
          </svg>`;

        svgData = encodeURIComponent(svgData);

        image.src = 'data:image/svg+xml,' + svgData;

        $('.listBox').append(`
                  <div class="list" data-idx=${v.idx}>
            <div class="content">
              <div class="imgBox">
                <a href="#"><img class="sibal" data-idx=${v.idx}></a>
              </div>
              <div class="info">
                <div class="title">
                  <a href="#">${v.name}</a>
                </div>
                <div class="des">
                  <span class="explain">${v.explain}</span>
                </div>
                <div class="createDate">
                  <i class="fa fa-calendar" aria-hidden="true"></i>
                  <span class="date">${new Date(v.date).ymdhms()}</span>
                </div>
              </div>
            </div>
            <div class="menuBox">
              <div class="editBtn left">
                <i class="fa fa-pencil-square-o" aria-hidden="true"></i> 수정
              </div>
              <div class="options left">
                <div class="btn btn-sm btn-danger delete">삭제 <i class="fa fa-trash"></i></div>
                <div class="btn btn-sm btn-primary htmlDownload">html 다운로드 <i class="fa fa-download"></i></div>
                <div class="btn btn-sm btn-primary thumbDownload">썸네일 다운로드 <i class="fa fa-download"></i></div>
              </div>
            </div>
          </div>
        `);
      });
    },
  };

  const Make = {
    start($target, x, y) {
      this.$target = $target;
      this.x = x;
      this.y = y;
    },

    move(x, y) {
      this.$target.style.left = Math.min(this.x, x) + 'px';
      this.$target.style.top = Math.min(this.y, y) + 'px';
      this.$target.style.width = Math.abs(this.x - x) + 'px';
      this.$target.style.height = Math.abs(this.y - y) + 'px';
    },

    end() {
      this.$target = null;
    },
  };

  const Move = {
    start($target, x, y) {
      this.$target = $target;
      this.x = x;
      this.y = y;
      this.left = parseInt($target.css('left'));
      this.top = parseInt($target.css('top'));
    },
    move(x, y) {
      const moveX = x - this.x;
      const moveY = y - this.y;

      this.$target.css({
        left: this.left + moveX,
        top: this.top + moveY,
      });
    },
    end() {
      this.$target = null;
    },
  };

  const Editor = {
    open(prop) {
      const { width, height, html, idx = false } = prop;

      $('#start').hide().next().show();

      $('#makeView').css({ height });

      $('#makeLayer')
        .css({
          width,
          height,
          overflow: 'hidden',
          border: '1px solid #ccc',
          position: 'relative',
        })
        .html(html);

      this.width = width;
      this.height = height;
      this.idx = idx;
      this.clear();
      this.state = 'open';
    },

    clear() {
      $('#leftMenu > div').removeClass('selected');
      this.tool = false;
    },

    getOffset(pageX, pageY) {
      const x = pageX - $('#makeLayer').offset().left;
      const y = pageY;
      return { x, y };
    },

    close() {
      $('#start').show().next().hide();
    },

    makeElement(tool, left, top) {
      const div = document.createElement('div');

      div.className = 'element ' + tool;
      div.style.position = 'absolute';
      div.style.left = left + 'px';
      div.style.top = top + 'px';
      div.setAttribute('tool', tool);
      if (tool === 'shape') div.style.border = '1px solid black';
      if (tool === 'text') div.style.backgroundColor = 'white';

      $('#makeLayer').append(div);

      if (tool === 'text') {
        div.setAttribute('contentEditAble', true);

        setTimeout(() => {
          div.focus();
        });
      }

      return div;
    },
  };

  // 스타일용 오브젝트
  const Option = {
    makeOption($target, $option) {
      this.$target = $target;
      this.$option = $option;
      this.canvas = $option.find('canvas')[0];
      this.ctx = this.canvas.getContext('2d');
      this.activeType = null;
      this.opacity = 1;

      $('.elementOption.clone').remove();
      $('#makeView').append($option);

      $option
        .on('mousedown', (e) => e.stopPropagation())
        .on('click', '#colorSelectView', (e) => Option.getColor(e))
        .on('click', '.box[data-type]', function () {
          const $type = $(this).data('type');
          Option.activeType = $type;

          if ($('.box').find('.active')) $('.box.active').removeClass('active');

          $(this).addClass('active');
        })
        .on('click', '.createLink, .unlink', function (e) {
          const $target = $(e.target).hasClass('createLink')
            ? 'createLink'
            : 'unlink';

          if ($target) {
            let link = prompt('링크를 입력해주세요');

            if (link) {
              document.execCommand('createLink', false, link);
              $('a').attr('target', '_blank');
            }
          } else {
            document.execCommand('unlink', false, false);
          }
        })
        .on('input', '.color', function () {
          Option.makeColorPicker(this.value);
        })
        .on('input', '.alpha', function () {
          Option.opacity = $(this).val() / 100;
          Option.colorChange();
        })
        .on('change', '#fontSize', function () {
          document.execCommand('fontsize', false, this.value);
        })
        .on('change', '#borderSize', function () {
          Option.$target.css('borderWidth', $(this).val());
        });

      this.makeColorPicker(360);
    },

    getColor(e) {
      const imageData = this.ctx.getImageData(e.offsetX, e.offsetY, 1, 1);

      this.rgb = imageData.data.slice(0, 3);
      this.colorChange();
    },

    colorChange() {
      const rgba = [...this.rgb, this.opacity];
      const rgbaCode = `rgba(${rgba.join(', ')})`;
      if ($('.box.active').length) {
        switch (this.activeType) {
          case 'backgroundColor':
          case 'borderColor':
            this.$target.css(this.activeType, rgbaCode);
            break;
          case 'fontColor':
            document.execCommand('styleWithCSS', false, true);
            document.execCommand('foreColor', false, rgbaCode);
            break;
        }

        $('.active > .currentColor').css('backgroundColor', rgbaCode);
      }
    },

    makeColorPicker(hue) {
      const { canvas, ctx } = this;
      const grd1 = ctx.createLinearGradient(0, 0, 200, 0);
      const grd2 = ctx.createLinearGradient(0, 0, 0, 120);

      grd1.addColorStop(0, `hsl(${hue}, 100%, 100%)`);
      grd1.addColorStop(1, `hsl(${hue}, 100%, 50%)`);

      grd2.addColorStop(0, 'transparent');
      grd2.addColorStop(1, 'black');

      ctx.fillStyle = grd1;
      ctx.fillRect(0, 0, 200, 120);

      ctx.fillStyle = grd2;
      ctx.fillRect(0, 0, 200, 120);
    },
  };

  $(document)
    .on('click', '#makeWebBtn', () => {
      const height = prompt('페이지의 높이를 입력해주세요.');

      if (height === null) {
        return;
      }

      if (height.match(/^[0-9]+$/) === null) {
        alert('페이지의 높이는 자연수를 입력해주세요');
        return;
      }

      Editor.open({ width: $(window).width(), height: height, html: '' });
    })
    .on('click', '#openList, #closeList', function (e) {
      $('#saveList').css('right', e.target.id === 'openList' ? 0 : '500px');
    })
    .on('click', '#closeList', function () {
      $('#saveList').css('right', '-500px');
    })
    .on('keydown', (e) => {
      if (Editor.state === 'open' && e.keyCode === 9) {
        $('#leftMenu').toggleClass('on');
        e.preventDefault();
      }
    })
    .on('click', '#leftMenu .btnBlock', function () {
      const tool = $(this).data('type');

      $('.element.text').attr('contenteditable', tool === 'text');
      $(".element[tool='shape']").css({
        resize: tool === 'crop' ? 'both' : 'none',
        overflow: 'auto',
      });

      switch (tool) {
        case 'home':
          Editor.close();
          break;
        case 'save':
          $('#back, #popup').show();
          break;
        case 'trash':
          if (confirm('삭제하시겠습니까?')) $('#makeLayer > div').remove();
          break;
        default:
          Editor.tool = tool;
          $(this).addClass('selected').siblings().removeClass('selected');
          break;
      }
    })
    .on('click', '.save-btn', function () {
      const name = $('#name').val();
      const explain = $('#explain').val();

      let webSite = JSON.parse(LS.getItem('webSite'));

      $('#back, #popup').hide();

      if (Editor.idx) {
        webSite.list = webSite.list.map((x) => {
          if (x.idx === Editor.idx) {
            x.html = $('#makeLayer').html();
            x.name = name;
            x.explain = explain;
            x.date = new Date();
          }
          return x;
        });
      } else {
        webSite.list.push({
          idx: ++webSite.idx,
          name,
          explain,
          width: Editor.width,
          height: Editor.height,
          date: new Date(),
          html: $('#makeLayer').html(),
        });
      }

      LS.setItem('webSite', JSON.stringify(webSite));

      Editor.idx = webSite.idx;

      List.refresh();
    })
    .on(
      'click',
      '.delete, .editBtn, .htmlDownload, .thumbDownload',
      function () {
        const $list = $(this).parents('.list');
        const $idx = $list.data('idx');
        const data = JSON.parse(LS.getItem('webSite'));
        const list = data.list.filter((el) => el.idx === $idx)[0];

        if ($(this).hasClass('delete')) {
          data.list = data.list.filter((el) => el.idx !== $idx);
          LS.setItem('webSite', JSON.stringify(data));
        }

        if ($(this).hasClass('editBtn')) {
          Editor.open({
            width: list.width,
            height: list.height,
            html: list.html,
            idx: list.idx,
          });
        }

        if ($(this).hasClass('htmlDownload')) {
          const $wrap = $('<div></div>', {
            css: {
              width: list.width,
              height: list.height,
              position: 'relative',
              margin: '0 auto',
            },
            html: list.html,
          });
          const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${list.name}</title>
      </head>
      <body>
        ${$wrap[0].outerHTML}
      </body>
      </html>
      `;

          const htmlBlob = new Blob([html], { type: 'text/html' });
          const a = document.createElement('a');

          a.href = URL.createObjectURL(htmlBlob);
          a.download = list.name + '.html';

          a.click();
        }

        if ($(this).hasClass('thumbDownload')) {
          const a = document.createElement('a');

          a.href = $list.find('.sibal').attr('src');
          a.download = list.name + '.png';

          a.click();
        }

        List.refresh();
      }
    )
    .on('change', '#sort, #order', function () {
      List.refresh();
    });

  $('#makeView').on('mousedown', () => $('.elementOption.clone').remove());

  $('#makeLayer')
    .on('mousedown mousemove mouseup', function (e) {
      const { x, y } = Editor.getOffset(e.pageX, e.pageY);

      switch (e.type) {
        case 'mousedown':
          if (e.buttons === 2) {
            return false;
          }

          if (['shape', 'text'].includes(Editor.tool)) {
            const $element = Editor.makeElement(Editor.tool, x, y);
            if (Editor.tool === 'shape') {
              Make.start($element, x, y);
            }
          }
          break;
        case 'mousemove':
          if (Make.$target) Make.move(x, y);

          if (Move.$target) Move.move(x, y);
          break;
        case 'mouseup':
          if (Make.$target) Make.end();
          break;
      }
    })
    .on('drop dragover', function (e) {
      const { x, y } = Editor.getOffset(e.pageX, e.pageY);

      e.preventDefault();

      if (e.type === 'drop') {
        const file = e.originalEvent.dataTransfer.files[0];
        const fileReader = new FileReader();
        const image = new Image();

        const error = () => {
          alert('이미지를 업로드해주세요');
        };

        image.onload = function () {
          const elementImg = Editor.makeElement('image', x, y);

          $(elementImg).css({
            width: image.width,
            height: image.height,
            backgroundImage: `url("${image.src}")`,
          });
        };

        fileReader.onload = function (e) {
          image.src = e.target.result;
        };

        image.onerror = error;
        fileReader.onerror = error;

        fileReader.readAsDataURL(file);
      }
    })
    .on('mousedown mouseup contextmenu', '.element', function (e) {
      const { x, y } = Editor.getOffset(e.pageX, e.pageY);
      const $type = $(this).attr('tool');

      switch (e.type) {
        case 'mousedown':
          if (e.buttons === 2) {
            return false;
          }
          if (Editor.tool === 'mouse') {
            Move.start($(this), x, y);
          }

          if (Editor.tool === 'text' && $type === 'text') {
            $('.elementOption.clone').remove();
            e.stopPropagation();
          }
          break;

        case 'mouseup':
          if (Move.$target) Move.end();
          break;
        case 'contextmenu':
          if ($type === 'image') return false;
          if (['text', 'shape'].includes(Editor.tool)) {
            e.preventDefault();

            const selection = window.getSelection();

            if ($type === 'text' && selection.toString() === '') return false;

            $('.elementOption.clone') && $('.elementOption.clone').remove();

            const $option = $('.elementOption').clone();

            $option
              .css({
                display: 'block',
                left: e.pageX,
                top: e.pageY,
              })
              .addClass('clone')
              .show()
              .find('.box')
              .hide()
              .parent()
              .find(`.${$type}-box`)
              .show();

            Option.makeOption($(this), $option);
          }
          break;
      }
    });

  List.init();
})();
