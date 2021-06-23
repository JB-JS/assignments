window.dd = console.log.bind(console)

Array.prototype.get = function (match) {
  return this.filter((el) => {
    let err = false
    Object.keys(match).forEach((val, idx) => {
      if (match[val] !== el[val]) {
        err = true
      }
    })

    if (!err) return el
  })
}

/* GLOBAL FUNCTION */
const changeFormData = (data) => {
  const result = {}
  $.each(data, (idx, val) => {
    result[val.name] = val.value
  })
  return result
}

const isImage = (file) => file.type.match(/^image\/[a-zA-Z]+$/) === null

const popupClose = () => $('.bg span').click()

const convertToImage = (file) =>
  file ? URL.createObjectURL(file) : 'images/basic.jpg'

/* indexedDB */
const IDB = {
  open(name) {
    return new Promise((resolve, reject) => {
      const IDBOpenDBRequest = indexedDB.open(name, 5)
      IDBOpenDBRequest.onupgradeneeded = (e) => {
        const db = e.target.result
        const option = { keyPath: 'idx', autoIncrement: true }

        db.createObjectStore('gallery', option)
        db.createObjectStore('users', option)
        db.createObjectStore('comment', option)
      }

      IDBOpenDBRequest.onsuccess = (e) => {
        IDB.db = e.target.result
        resolve()
      }
    })
  },

  table(table) {
    return this.db.transaction(table, 'readwrite').objectStore(table)
  },

  getTable(table) {
    return new Promise((resolve, reject) => {
      IDB.table(table).getAll().onsuccess = (e) => {
        resolve(e.target.result)
      }
    })
  },
}

const Data = {
  users: [],
  gallery: [],
  comment: [],

  refresh() {
    return new Promise((resolve, reject) => {
      Promise.all([
        IDB.getTable('gallery'),
        IDB.getTable('users'),
        IDB.getTable('comment'),
      ]).then((datas) => {
        const [gallery, users, comment] = datas

        if (users.length === 0) {
          IDB.table('users').put({
            join_id: 'admin',
            join_pw: '1234!',
            nickname: '관리자',
          })
        }

        this.users = users
        this.gallery = gallery
        this.comment = comment

        resolve()
      })
    })
  },
}

const App = {
  async init() {
    await Data.refresh()
    this.loginState()
    Gallery.refresh()
  },

  loginState() {
    this.login = sessionStorage.getItem('user')
    this.userInfo = Data.users.filter((user) => user.idx === +this.login)[0]
    const { login, userInfo } = this

    if (login) {
      $('.login-view').show()
      $('.no-login-view').hide()
      $('.upload_btn').show()
      $('.member_img').attr('src', convertToImage(userInfo.file))
      $('.member_name').text(userInfo.nickname)
    } else {
      $('.no-login-view').show()
      $('.upload_btn').hide()
      $('.login-view').hide()
    }
  },

  commentAppend(feedidx) {
    // const comment = Data.comment.filter((el) => el.idx === idx)[0]
    // const writer = Data.users.filter((user) => user.idx === comment.userIdx)[0]
    const comment = [...Data.comment.get({ feedidx })]
    const $target = $(`#comment-form[data-feedidx="${feedidx}"]`)

    // $target.siblings('ul').find('li').remove()

    comment.forEach((val, idx) => {
      const [writer] = Data.users.get({ idx: val.userIdx })

      $target.siblings('ul').append(`
      <li>
      <span class="comment_name">${writer.nickname}</span>
      <span class="comment_text">${val.content}</span>
      </li>
      `)
    })
  },
}

const Gallery = {
  upload(data) {
    const file = $('#img')[0].files[0]

    if (!file) return alert('사진을 선택해주세요')

    if (isImage(file)) return alert('이미지파일을 업로드해주세요')

    data.file = file
    data.date = new Date()
    data.userIdx = +sessionStorage.getItem('user')

    IDB.table('gallery').put(data).onsuccess = () => {
      App.init()
      popupClose()
      document.getElementById('upload-form').reset()
    }
  },

  refresh() {
    const gallery = [...Data.gallery]
    let html = ''

    gallery.forEach((feed) => {
      const writer = Data.users.filter((user) => user.idx === feed.userIdx)[0]

      html += `
              <!-- feeds -->
              <div class="col-md-12 feeds box">
                <!-- 갤러리 -->
                <div class="gallery">
                  <img src="${convertToImage(
                    writer.file
                  )}" alt="img" class="gallery_img" />
                  <span class="gallery_name">${writer.nickname}</span>
                  <span class="gallery_like"
                    ><i class="fa fa-star"></i> 1.5천</span
                  >
                  <hr />
                  <p class="gallery_text">${feed.description}</p>
                  <img src="${convertToImage(
                    feed.file
                  )}" alt="img" class="gallery_main" />
                  <hr />
                </div>
                <div>
                  <!-- 게시물 삭제 -->
                  
                  <form id="comment-form" data-feedidx="${feed.idx}">
                  ${
                    App.login
                      ? `${
                          App.login === feed.userIdx
                            ? '<button class="gallery_delete">게시물 삭제</button>'
                            : ''
                        }
                    <span class="comment">댓글</span>
                    <span class="comment_name">${App.userInfo.nickname}</span>
                    <input
                      type="text"
                      placeholder="댓글을 입력하세요."
                      name="content"
                      class="comment_input"
                    />
                    <button class="comment_button">댓글 등록</button>`
                      : ''
                  }
                  </form>
                  <ul class="comment_ul">
                    <li>
                      <span class="comment_name">노길동</span>
                      <span class="comment_text">정말 아름다운 경치에요!</span>
                    </li>
                    <li>
                      <span class="comment_name">김길동</span>
                      <span class="comment_text">멋있어요!</span>
                    </li>
                  </ul>
                </div>
              </div> 
      `
    })

    if (!html) {
      html += '<div class="col-md-12 feeds box"></div>'
    }

    $('.newsfeed .row').html(html)
    gallery.forEach((feed) => {
      App.commentAppend(feed.idx)
    })
  },
}

// common.js
const Member = {
  message: {
    id: '아이디를 입력해주세요.',
    pw: '비밀번호를 입력해주세요.',
    nickname: '닉네임을 입력해주세요.',
    pw_chk: '비밀번호와 비밀번호 확인이 일치하지 않습니다.',
    overlap: '중복된 아이디입니다!',
    pwReg:
      '비밀번호에는 특수문자(!,@,#,$,%,?,^,&,*)중 한개 이상이 포함 되어야합니다',
  },

  join(data) {
    const errMessage = []
    const files = $('#join_profile')[0].files
    const { join_id: id, join_pw: pw, nickname } = data
    const { message } = Member

    data.file = files.length && files[0]

    if (!id) errMessage.push(message.id)

    if (!pw) errMessage.push(message.pw)

    if (pw !== data.pw_chk) errMessage.push(message.pw_chk)

    if (pw.match(/[\!\@\#\$\%\^\&\*]/) === null) errMessage.push(message.pwReg)

    if (!nickname) errMessage.push(message.nickname)

    if (errMessage.length) {
      alert(errMessage.join('\n'))
    } else {
      IDB.table('users').put(data).onsuccess = () => {
        alert('회원가입이 완료되었습니다.')
        Data.refresh()
        document.getElementById('join-form').reset()
        popupClose()
      }
    }
  },

  login(data) {
    const user = Data.users.get({ join_id: data.id, join_pw: data.pw })[0]
    const errMessage = []

    if (!data.id) errMessage.push('아이디를 입력해주세요.')

    if (!data.pw) errMessage.push('비밀번호를 입력해주세요')

    if (errMessage.length) {
      alert(errMessage.join('\n'))
    }

    if (user) {
      sessionStorage.setItem('user', user.idx)
      alert('로그인이 완료되었습니다.')
      App.init()
      document.getElementById('login-form').reset()
      popupClose()
    } else {
      return alert('존재하지 않는 아이디이거나 비밀번호를 잘못 입력헀습니다')
    }
  },

  logout() {
    sessionStorage.removeItem('user')
    alert('로그아웃이 완료되었습니다.')
    App.init()
  },
}

const Comment = {
  write(data, feedidx) {
    if (!data.content) return alert('댓글 내용을 입력해주세요')

    const putData = Object.assign(
      {
        feedidx,
        date: new Date(),
        userIdx: +App.login,
      },
      data
    )

    IDB.table('comment').put(putData).onsuccess = async () => {
      $(`#comment-form[data-feedidx="${feedidx}"]`)[0].reset()
      await Data.refresh()
      App.commentAppend(feedidx)
    }
  },
}

$(function () {
  // login
  $('.login_btn').click(function (e) {
    $('.bg').css({ 'z-index': '1', opacity: '1' })
    $('.login').show()

    $('.bg span').click(function (e) {
      $('.bg').css({ 'z-index': '-1', opacity: '0' })
      $('.login').hide()
    })
  })

  // join
  $('.join_btn').click(function (e) {
    $('.bg').css({ 'z-index': '1', opacity: '1' })
    $('.join').show()

    $('.bg span').click(function (e) {
      $('.bg').css({ 'z-index': '-1', opacity: '0' })
      $('.join').hide()
    })
  })

  // upload
  $('.upload_btn').click(function (e) {
    $('.bg').css({ 'z-index': '1', opacity: '1' })
    $('.upload').show()

    $('.bg span').click(function (e) {
      $('.bg').css({ 'z-index': '-1', opacity: '0' })
      $('.upload').hide()
    })
  })

  IDB.open('jstagram').then(() => {
    App.init()
  })

  // event
  $(document)
    .on('submit', '#join-form', function (e) {
      e.preventDefault()
      Member.join(changeFormData($(this).serializeArray()))
    })
    .on('submit', '#login-form', function (e) {
      e.preventDefault()
      Member.login(changeFormData($(this).serializeArray()))
    })
    .on('submit', '#upload-form', function (e) {
      e.preventDefault()
      Gallery.upload(changeFormData($(this).serializeArray()))
    })
    .on('submit', '#comment-form', function (e) {
      e.preventDefault()

      Comment.write(
        changeFormData($(this).serializeArray()),
        $(this).data('feedidx')
      )
    })
    .on('click', '#logout', function () {
      Member.logout()
    })
})
