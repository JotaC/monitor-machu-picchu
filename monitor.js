import { chromium } from 'playwright';
import fs from 'node:fs';

const CONFIG = Object.freeze({
  siteUrl: 'https://tuboleto.cultura.pe/llaqta_machupicchu',

  requiredTickets: Number.parseInt(
    process.env.REQUIRED_TICKETS || '4',
    10
  ),

  notifyStatus:
    String(
      process.env.NOTIFY_STATUS || 'false'
    ).toLowerCase() === 'true',

  timeZone: 'America/Lima',
  stateFile: 'state.json',
  diagnosticDirectory: 'diagnostico',
  pageTimeoutMs: 60_000,
  actionTimeoutMs: 30_000
});


/* ============================================================
 * RUTAS
 * ============================================================
 */

const ROUTES = Object.freeze([
  {
    code: '1-A',
    circuitText: 'Circuito 1',
    routeText: 'Ruta 1-A',
    name: 'Montaña Machupicchu'
  },
  {
    code: '1-B',
    circuitText: 'Circuito 1',
    routeText: 'Ruta 1-B',
    name: 'Terraza superior'
  },
  {
    code: '1-C',
    circuitText: 'Circuito 1',
    routeText: 'Ruta 1-C',
    name: 'Portada Intipunku'
  },
  {
    code: '1-D',
    circuitText: 'Circuito 1',
    routeText: 'Ruta 1-D',
    name: 'Puente Inka'
  },
  {
    code: '2-A',
    circuitText: 'Circuito 2',
    routeText: 'Ruta 2-A',
    name: 'Clásico Diseñada'
  },
  {
    code: '2-B',
    circuitText: 'Circuito 2',
    routeText: 'Ruta 2-B',
    name: 'Terraza inferior'
  },
  {
    code: '3-A',
    circuitText: 'Circuito 3',
    routeText: 'Ruta 3-A',
    name: 'Montaña Waynapicchu'
  },
  {
    code: '3-B',
    circuitText: 'Circuito 3',
    routeText: 'Ruta 3-B',
    name: 'Realeza diseñada'
  },
  {
    code: '3-C',
    circuitText: 'Circuito 3',
    routeText: 'Ruta 3-C',
    name: 'Gran Caverna'
  },
  {
    code: '3-D',
    circuitText: 'Circuito 3',
    routeText: 'Ruta 3-D',
    name: 'Huchuypicchu'
  }
]);


/* ============================================================
 * MESES
 * ============================================================
 */

const MONTHS = Object.freeze({
  ENE: 0,
  ENERO: 0,
  JAN: 0,

  FEB: 1,
  FEBRERO: 1,

  MAR: 2,
  MARZO: 2,

  ABR: 3,
  ABRIL: 3,
  APR: 3,

  MAY: 4,
  MAYO: 4,

  JUN: 5,
  JUNIO: 5,

  JUL: 6,
  JULIO: 6,

  AGO: 7,
  AGOSTO: 7,
  AUG: 7,

  SET: 8,
  SEP: 8,
  SEPT: 8,
  SEPTIEMBRE: 8,

  OCT: 9,
  OCTUBRE: 9,

  NOV: 10,
  NOVIEMBRE: 10,

  DIC: 11,
  DICIEMBRE: 11,
  DEC: 11
});


const SPANISH_MONTHS = Object.freeze([
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre'
]);


/* ============================================================
 * FECHAS Y TEXTO
 * ============================================================
 */

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .replace(
      /\s+/g,
      ' '
    )
    .trim();
}


function getDatePartsInLima(
  date = new Date()
) {
  const values = {};

  const parts =
    new Intl.DateTimeFormat(
      'en-CA',
      {
        timeZone:
          CONFIG.timeZone,

        year:
          'numeric',

        month:
          '2-digit',

        day:
          '2-digit'
      }
    ).formatToParts(date);

  for (
    const part of parts
  ) {
    if (
      [
        'year',
        'month',
        'day'
      ].includes(part.type)
    ) {
      values[part.type] =
        Number(part.value);
    }
  }

  return {
    year:
      values.year,

    month:
      values.month,

    day:
      values.day
  };
}


/**
 * Calcula automáticamente mañana
 * usando la fecha de Lima, Perú.
 */
function getTomorrowInLima() {
  const today =
    getDatePartsInLima();

  const date =
    new Date(
      Date.UTC(
        today.year,
        today.month - 1,
        today.day + 1
      )
    );

  const year =
    date.getUTCFullYear();

  const month =
    date.getUTCMonth() + 1;

  const day =
    date.getUTCDate();

  return {
    iso:
      String(year).padStart(4, '0') +
      '-' +
      String(month).padStart(2, '0') +
      '-' +
      String(day).padStart(2, '0'),

    date
  };
}


function formatDatePE(
  isoDate
) {
  const [
    year,
    month,
    day
  ] = isoDate.split('-');

  return (
    day +
    '/' +
    month +
    '/' +
    year
  );
}


function getLimaTimestamp() {
  return new Intl.DateTimeFormat(
    'es-PE',
    {
      timeZone:
        CONFIG.timeZone,

      dateStyle:
        'short',

      timeStyle:
        'medium'
    }
  ).format(
    new Date()
  );
}


function parseCalendarMonth(
  label
) {
  const clean =
    normalizeText(label)
      .toUpperCase()
      .replace(
        /\./g,
        ''
      );

  const parts =
    clean.split(' ');

  if (
    parts.length < 2
  ) {
    return null;
  }

  const month =
    MONTHS[parts[0]];

  const year =
    Number.parseInt(
      parts.at(-1),
      10
    );

  if (
    month === undefined ||
    !Number.isInteger(year)
  ) {
    return null;
  }

  return {
    month,
    year
  };
}


/* ============================================================
 * VALIDACIÓN
 * ============================================================
 */

function validateConfiguration() {
  if (
    !Number.isInteger(
      CONFIG.requiredTickets
    ) ||
    CONFIG.requiredTickets < 1
  ) {
    throw new Error(
      'REQUIRED_TICKETS debe ser un número entero mayor que cero.'
    );
  }
}


/* ============================================================
 * DIAGNÓSTICO
 * ============================================================
 */

function ensureDiagnosticDirectory() {
  fs.mkdirSync(
    CONFIG.diagnosticDirectory,
    {
      recursive: true
    }
  );
}


function sanitizeFileName(
  value
) {
  return normalizeText(value)
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      '-'
    )
    .replace(
      /^-+|-+$/g,
      ''
    );
}


async function saveDiagnostic(
  page,
  name
) {
  ensureDiagnosticDirectory();

  const safeName =
    sanitizeFileName(name);

  await page
    .screenshot({
      path:
        CONFIG.diagnosticDirectory +
        '/' +
        safeName +
        '.png',

      fullPage:
        true
    })
    .catch(
      error => {
        console.warn(
          'No se pudo guardar ' +
          safeName +
          '.png:',
          error.message
        );
      }
    );

  const html =
    await page
      .content()
      .catch(
        () => ''
      );

  if (
    html
  ) {
    fs.writeFileSync(
      CONFIG.diagnosticDirectory +
      '/' +
      safeName +
      '.html',

      html,
      'utf8'
    );
  }
}


/* ============================================================
 * ESTADO DEL MONITOR
 * ============================================================
 */

function loadState() {
  try {
    if (
      !fs.existsSync(
        CONFIG.stateFile
      )
    ) {
      return {
        targetDate: '',
        availableKeys: [],
        allRoutesFailed: false
      };
    }

    const state =
      JSON.parse(
        fs.readFileSync(
          CONFIG.stateFile,
          'utf8'
        )
      );

    return {
      targetDate:
        String(
          state.targetDate || ''
        ),

      availableKeys:
        Array.isArray(
          state.availableKeys
        )
          ? state.availableKeys.map(
            String
          )
          : [],

      allRoutesFailed:
        state.allRoutesFailed ===
        true
    };

  } catch (error) {
    console.warn(
      'No se pudo leer state.json:',
      error.message
    );

    return {
      targetDate: '',
      availableKeys: [],
      allRoutesFailed: false
    };
  }
}


function saveState(
  targetDate,
  availableKeys,
  allRoutesFailed
) {
  const state = {
    targetDate,

    availableKeys:
      [
        ...new Set(
          availableKeys
        )
      ].sort(),

    allRoutesFailed:
      allRoutesFailed === true
  };

  fs.writeFileSync(
    CONFIG.stateFile,

    JSON.stringify(
      state,
      null,
      2
    ) + '\n',

    'utf8'
  );
}


/* ============================================================
 * TELEGRAM
 * ============================================================
 */

function splitTelegramMessage(
  text,
  maxLength = 3900
) {
  const chunks = [];

  let remaining =
    String(text || '');

  while (
    remaining.length >
    maxLength
  ) {
    let splitAt =
      remaining.lastIndexOf(
        '\n',
        maxLength
      );

    if (
      splitAt <
      Math.floor(
        maxLength * 0.6
      )
    ) {
      splitAt =
        maxLength;
    }

    chunks.push(
      remaining
        .slice(
          0,
          splitAt
        )
        .trim()
    );

    remaining =
      remaining
        .slice(
          splitAt
        )
        .trim();
  }

  if (
    remaining
  ) {
    chunks.push(
      remaining
    );
  }

  return chunks;
}


async function sendTelegram(
  text
) {
  const token =
    process.env.BOT_TOKEN;

  const chatId =
    process.env.CHAT_ID;

  if (
    !token ||
    !chatId
  ) {
    throw new Error(
      'No se encontraron BOT_TOKEN o CHAT_ID.'
    );
  }

  const chunks =
    splitTelegramMessage(
      text
    );

  for (
    const chunk of chunks
  ) {
    const response =
      await fetch(
        'https://api.telegram.org/bot' +
        token +
        '/sendMessage',

        {
          method:
            'POST',

          headers: {
            'Content-Type':
              'application/json'
          },

          body:
            JSON.stringify({
              chat_id:
                chatId,

              text:
                chunk,

              disable_web_page_preview:
                false
            })
        }
      );

    const responseText =
      await response.text();

    if (
      !response.ok
    ) {
      throw new Error(
        'Telegram respondió HTTP ' +
        response.status +
        ': ' +
        responseText
      );
    }

    const result =
      JSON.parse(
        responseText
      );

    if (
      !result.ok
    ) {
      throw new Error(
        'Telegram rechazó el mensaje: ' +
        responseText
      );
    }
  }
}


/* ============================================================
 * PETICIONES QUE PODEMOS IGNORAR
 * ============================================================
 */

function isIgnoredRequest(
  url
) {
  return (
    url.includes(
      'google-analytics.com'
    ) ||
    url.includes(
      'googletagmanager.com'
    ) ||
    url.includes(
      'doubleclick.net'
    ) ||
    url.includes(
      'sentry.io'
    )
  );
}


/* ============================================================
 * CARGA DE TU BOLETO
 * ============================================================
 */

async function waitForPageReady(
  page
) {
  await page
    .getByText(
      'Adquiere tu boleto',
      {
        exact: false
      }
    )
    .waitFor({
      state:
        'visible',

      timeout:
        CONFIG.pageTimeoutMs
    });

  await page
    .locator(
      'mat-select'
    )
    .nth(0)
    .waitFor({
      state:
        'visible',

      timeout:
        CONFIG.pageTimeoutMs
    });

  await page
    .locator(
      'mat-select'
    )
    .nth(1)
    .waitFor({
      state:
        'visible',

      timeout:
        CONFIG.pageTimeoutMs
    });
}


/* ============================================================
 * SELECTORES DE ANGULAR MATERIAL
 * ============================================================
 */

async function waitForSelectEnabled(
  select,
  timeoutMs =
    CONFIG.actionTimeoutMs
) {
  const startedAt =
    Date.now();

  while (
    Date.now() -
      startedAt <
    timeoutMs
  ) {
    const ariaDisabled =
      await select.getAttribute(
        'aria-disabled'
      );

    const disabled =
      await select.getAttribute(
        'disabled'
      );

    if (
      ariaDisabled !== 'true' &&
      disabled === null
    ) {
      return;
    }

    await select
      .page()
      .waitForTimeout(
        300
      );
  }

  throw new Error(
    'El selector continuó deshabilitado.'
  );
}


async function openMaterialOptions(
  page,
  select,
  label
) {
  let lastError =
    null;

  for (
    let attempt = 1;
    attempt <= 4;
    attempt++
  ) {
    console.log(
      'Intento ' +
      attempt +
      ' para abrir ' +
      label +
      '.'
    );

    await page.keyboard
      .press('Escape')
      .catch(
        () => {}
      );

    await page.waitForTimeout(
      300
    );

    const trigger =
      select
        .locator(
          '.mat-mdc-select-trigger, ' +
          '.mat-select-trigger'
        )
        .first();

    try {
      if (
        await trigger.count()
      ) {
        await trigger.click({
          timeout:
            8000
        });

      } else {
        await select.click({
          timeout:
            8000
        });
      }

    } catch (error) {
      lastError =
        error;

      try {
        await select.click({
          force:
            true,

          timeout:
            8000
        });

      } catch (forceError) {
        lastError =
          forceError;
      }
    }

    const options =
      page.locator(
        '.cdk-overlay-pane [role="option"], ' +
        '.cdk-overlay-pane mat-option'
      );

    try {
      await options
        .first()
        .waitFor({
          state:
            'visible',

          timeout:
            6000
        });

      return options;

    } catch (error) {
      lastError =
        error;
    }

    try {
      await select.focus();

      await select.press(
        'Enter'
      );

      await options
        .first()
        .waitFor({
          state:
            'visible',

          timeout:
            6000
        });

      return options;

    } catch (error) {
      lastError =
        error;
    }
  }

  throw new Error(
    'No se pudo abrir el selector de ' +
    label +
    '. Último error: ' +
    (
      lastError?.message ||
      'desconocido'
    )
  );
}


async function selectMaterialOption(
  page,
  selectIndex,
  targetText,
  label
) {
  const select =
    page
      .locator(
        'mat-select'
      )
      .nth(
        selectIndex
      );

  await select.waitFor({
    state:
      'visible',

    timeout:
      CONFIG.actionTimeoutMs
  });

  await waitForSelectEnabled(
    select
  );

  await select
    .scrollIntoViewIfNeeded();

  const options =
    await openMaterialOptions(
      page,
      select,
      label
    );

  const optionCount =
    await options.count();

  const normalizedTarget =
    normalizeText(
      targetText
    ).toLowerCase();

  const descriptions =
    [];

  let selectedOption =
    null;

  for (
    let index = 0;
    index < optionCount;
    index++
  ) {
    const option =
      options.nth(index);

    if (
      !await option
        .isVisible()
        .catch(
          () => false
        )
    ) {
      continue;
    }

    const text =
      normalizeText(
        await option
          .innerText()
          .catch(
            () => ''
          )
      );

    descriptions.push(
      text
    );

    if (
      text
        .toLowerCase()
        .includes(
          normalizedTarget
        )
    ) {
      selectedOption =
        option;

      break;
    }
  }

  if (
    !selectedOption
  ) {
    await page.keyboard
      .press('Escape')
      .catch(
        () => {}
      );

    console.log(
      'No se encontró ' +
      targetText +
      '. Opciones: ' +
      descriptions.join(' | ')
    );

    return false;
  }

  const ariaDisabled =
    await selectedOption
      .getAttribute(
        'aria-disabled'
      );

  const disabled =
    await selectedOption
      .getAttribute(
        'disabled'
      );

  const className =
    String(
      await selectedOption
        .getAttribute(
          'class'
        ) || ''
    );

  if (
    ariaDisabled === 'true' ||
    disabled !== null ||
    className.includes(
      'option-disabled'
    )
  ) {
    await page.keyboard
      .press('Escape')
      .catch(
        () => {}
      );

    console.log(
      'La opción ' +
      targetText +
      ' está deshabilitada.'
    );

    return false;
  }

  console.log(
    'Seleccionando:',
    normalizeText(
      await selectedOption.innerText()
    )
  );

  await selectedOption
    .click({
      timeout:
        10_000
    })
    .catch(
      async () => {
        await selectedOption.click({
          force:
            true,

          timeout:
            10_000
        });
      }
    );

  await page.waitForTimeout(
    900
  );

  return true;
}


/* ============================================================
 * CALENDARIO
 * ============================================================
 */

async function openTargetCalendar(
  page
) {
  const input =
    page
      .locator(
        'input[matinput][readonly]'
      )
      .first();

  await input.waitFor({
    state:
      'visible',

    timeout:
      CONFIG.actionTimeoutMs
  });

  const calendar =
    page.locator(
      'mat-calendar:visible'
    );

  if (
    !await calendar
      .isVisible()
      .catch(
        () => false
      )
  ) {
    await input
      .click({
        timeout:
          8000
      })
      .catch(
        async () => {
          await input.click({
            force:
              true,

            timeout:
              8000
          });
        }
      );
  }

  await calendar.waitFor({
    state:
      'visible',

    timeout:
      CONFIG.actionTimeoutMs
  });
}


async function waitForCalendarLabelChange(
  periodButton,
  previousLabel
) {
  for (
    let attempt = 0;
    attempt < 30;
    attempt++
  ) {
    await periodButton
      .page()
      .waitForTimeout(
        250
      );

    const currentLabel =
      normalizeText(
        await periodButton.innerText()
      );

    if (
      currentLabel !==
      normalizeText(
        previousLabel
      )
    ) {
      return;
    }
  }
}


async function navigateCalendarToTargetMonth(
  page,
  targetDate
) {
  const targetYear =
    targetDate.getUTCFullYear();

  const targetMonth =
    targetDate.getUTCMonth();

  const periodButton =
    page.locator(
      '.mat-calendar-period-button:visible'
    );

  await periodButton.waitFor({
    state:
      'visible',

    timeout:
      CONFIG.actionTimeoutMs
  });

  for (
    let attempt = 0;
    attempt < 24;
    attempt++
  ) {
    const label =
      await periodButton.innerText();

    const current =
      parseCalendarMonth(
        label
      );

    if (
      !current
    ) {
      throw new Error(
        'No se pudo interpretar el mes visible: ' +
        label
      );
    }

    const difference =
      (
        targetYear -
        current.year
      ) * 12 +
      (
        targetMonth -
        current.month
      );

    if (
      difference === 0
    ) {
      await page.waitForTimeout(
        1000
      );

      return;
    }

    const button =
      difference > 0
        ? page.locator(
          '.mat-calendar-next-button:visible'
        )
        : page.locator(
          '.mat-calendar-previous-button:visible'
        );

    const responsePromise =
      page
        .waitForResponse(
          response =>
            response
              .url()
              .includes(
                '/visita/consulta-fechas-disponibles'
              ) &&
            response
              .request()
              .method() ===
              'POST',

          {
            timeout:
              12_000
          }
        )
        .catch(
          () => null
        );

    await button
      .click({
        timeout:
          8000
      })
      .catch(
        async () => {
          await button.click({
            force:
              true,

            timeout:
              8000
          });
        }
      );

    await Promise.all([
      responsePromise,

      waitForCalendarLabelChange(
        periodButton,
        label
      )
    ]);
  }

  throw new Error(
    'No se pudo llegar al mes objetivo.'
  );
}


async function findTargetDayCell(
  page,
  targetDate
) {
  const targetDay =
    targetDate.getUTCDate();

  const targetMonth =
    targetDate.getUTCMonth();

  const targetYear =
    targetDate.getUTCFullYear();

  const monthName =
    SPANISH_MONTHS[
      targetMonth
    ];

  const cells =
    page.locator(
      'mat-calendar:visible ' +
      'button.mat-calendar-body-cell'
    );

  const count =
    await cells.count();

  let fallback =
    null;

  for (
    let index = 0;
    index < count;
    index++
  ) {
    const cell =
      cells.nth(index);

    const text =
      normalizeText(
        await cell
          .innerText()
          .catch(
            () => ''
          )
      );

    if (
      text !==
      String(targetDay)
    ) {
      continue;
    }

    fallback ??=
      cell;

    const ariaLabel =
      normalizeText(
        await cell.getAttribute(
          'aria-label'
        )
      ).toLowerCase();

    if (
      ariaLabel.includes(
        String(targetYear)
      ) &&
      ariaLabel.includes(
        monthName
      )
    ) {
      return cell;
    }
  }

  return fallback;
}


async function selectTargetDay(
  page,
  targetDate
) {
  const cell =
    await findTargetDayCell(
      page,
      targetDate
    );

  if (
    !cell
  ) {
    throw new Error(
      'No se encontró el día ' +
      targetDate.getUTCDate() +
      ' en el calendario.'
    );
  }

  const ariaDisabled =
    await cell.getAttribute(
      'aria-disabled'
    );

  const disabled =
    await cell.getAttribute(
      'disabled'
    );

  const className =
    String(
      await cell.getAttribute(
        'class'
      ) || ''
    );

  const isDisabled =
    ariaDisabled === 'true' ||
    disabled !== null ||
    className.includes(
      'mat-calendar-body-disabled'
    ) ||
    await cell
      .isDisabled()
      .catch(
        () => false
      );

  if (
    isDisabled
  ) {
    console.log(
      'La fecha está deshabilitada.'
    );

    return false;
  }

  const scheduleResponse =
    page
      .waitForResponse(
        response =>
          response
            .url()
            .includes(
              '/visita/consulta-horarios'
            ) &&
          response
            .request()
            .method() ===
            'POST',

        {
          timeout:
            12_000
        }
      )
      .catch(
        () => null
      );

  await cell
    .click({
      timeout:
        8000
    })
    .catch(
      async () => {
        await cell.click({
          force:
            true,

          timeout:
            8000
        });
      }
    );

  await scheduleResponse;

  await page.waitForTimeout(
    1000
  );

  return true;
}


/* ============================================================
 * HORARIOS
 * ============================================================
 */

async function readAvailableSlots(
  page
) {
  const scheduleSelect =
    page
      .locator(
        'mat-select'
      )
      .nth(2);

  if (
    !await scheduleSelect
      .isVisible()
      .catch(
        () => false
      )
  ) {
    console.log(
      'No apareció el selector de horarios.'
    );

    return [];
  }

  try {
    await waitForSelectEnabled(
      scheduleSelect,
      10_000
    );

  } catch {
    console.log(
      'El selector de horarios está deshabilitado.'
    );

    return [];
  }

  const options =
    await openMaterialOptions(
      page,
      scheduleSelect,
      'horarios'
    );

  const count =
    await options.count();

  const slots =
    [];

  for (
    let index = 0;
    index < count;
    index++
  ) {
    const option =
      options.nth(index);

    if (
      !await option
        .isVisible()
        .catch(
          () => false
        )
    ) {
      continue;
    }

    const text =
      normalizeText(
        await option
          .innerText()
          .catch(
            () => ''
          )
      );

    const ariaDisabled =
      await option.getAttribute(
        'aria-disabled'
      );

    const className =
      String(
        await option.getAttribute(
          'class'
        ) || ''
      );

    const disabled =
      ariaDisabled === 'true' ||
      className.includes(
        'option-disabled'
      );

    const timeMatch =
      text.match(
        /(\d{1,2}:\d{2})/
      );

    const seatsMatch =
      text.match(
        /(\d+)\s*(?:boletos?|entradas?|cupos?)/i
      );

    console.log(
      'Horario observado:',
      text
    );

    if (
      !timeMatch ||
      !seatsMatch
    ) {
      continue;
    }

    slots.push({
      time:
        timeMatch[1],

      seats:
        Number.parseInt(
          seatsMatch[1],
          10
        ),

      disabled,

      text
    });
  }

  await page.keyboard
    .press('Escape')
    .catch(
      () => {}
    );

  return slots;
}


/* ============================================================
 * REVISIÓN DE UNA RUTA
 * ============================================================
 */

async function checkRoute(
  context,
  route,
  target
) {
  const page =
    await context.newPage();

  page.setDefaultTimeout(
    CONFIG.actionTimeoutMs
  );

  await page.route(
    '**/*',
    async routeRequest => {
      const url =
        routeRequest
          .request()
          .url();

      if (
        isIgnoredRequest(
          url
        )
      ) {
        await routeRequest.abort();

      } else {
        await routeRequest.continue();
      }
    }
  );

  page.on(
    'requestfailed',
    request => {
      if (
        isIgnoredRequest(
          request.url()
        )
      ) {
        return;
      }

      console.warn(
        'Solicitud fallida:',
        request.url(),
        request.failure()
          ?.errorText || ''
      );
    }
  );

  try {
    console.log(
      '\n===================================='
    );

    console.log(
      'Revisando ruta ' +
      route.code +
      ': ' +
      route.name
    );

    /*
     * Se registra la espera antes de abrir la página.
     */
    const placeInfoPromise =
      page
        .waitForResponse(
          response =>
            response
              .url()
              .includes(
                '/visita/lugar-info'
              ) &&
            response.status() ===
              200,

          {
            timeout:
              CONFIG.pageTimeoutMs
          }
        )
        .catch(
          () => null
        );

    await page.goto(
      CONFIG.siteUrl,
      {
        waitUntil:
          'domcontentloaded',

        timeout:
          CONFIG.pageTimeoutMs
      }
    );

    await placeInfoPromise;

    await waitForPageReady(
      page
    );

    await page.waitForTimeout(
      700
    );

    const circuitSelected =
      await selectMaterialOption(
        page,
        0,
        route.circuitText,
        'circuito'
      );

    if (
      !circuitSelected
    ) {
      throw new Error(
        'No se encontró ' +
        route.circuitText +
        '.'
      );
    }

    /*
     * Se registra antes de seleccionar la ruta
     * para no perder la respuesta de las fechas.
     */
    const datesResponse =
      page
        .waitForResponse(
          response =>
            response
              .url()
              .includes(
                '/visita/consulta-fechas-disponibles'
              ) &&
            response
              .request()
              .method() ===
              'POST',

          {
            timeout:
              15_000
          }
        )
        .catch(
          () => null
        );

    const routeSelected =
      await selectMaterialOption(
        page,
        1,
        route.routeText,
        'ruta'
      );

    if (
      !routeSelected
    ) {
      return {
        route,
        processed: true,
        routeEnabled: false,
        dateEnabled: false,
        slots: [],
        matchingSlots: [],
        error: null
      };
    }

    await datesResponse;

    await openTargetCalendar(
      page
    );

    await navigateCalendarToTargetMonth(
      page,
      target.date
    );

    const dateEnabled =
      await selectTargetDay(
        page,
        target.date
      );

    if (
      !dateEnabled
    ) {
      return {
        route,
        processed: true,
        routeEnabled: true,
        dateEnabled: false,
        slots: [],
        matchingSlots: [],
        error: null
      };
    }

    const slots =
      await readAvailableSlots(
        page
      );

    const matchingSlots =
      slots.filter(
        slot =>
          !slot.disabled &&
          slot.seats >=
            CONFIG.requiredTickets
      );

    return {
      route,
      processed: true,
      routeEnabled: true,
      dateEnabled: true,
      slots,
      matchingSlots,
      error: null
    };

  } catch (error) {
    console.error(
      'Error en ruta ' +
      route.code +
      ':',
      error.message
    );

    await saveDiagnostic(
      page,
      'error-' +
      route.code
    );

    return {
      route,
      processed: false,
      routeEnabled: false,
      dateEnabled: false,
      slots: [],
      matchingSlots: [],
      error:
        error.message
    };

  } finally {
    await page.close();
  }
}


/* ============================================================
 * MENSAJES DE RESULTADO
 * ============================================================
 */

function groupAvailabilityByRoute(
  availableItems
) {
  const groups =
    new Map();

  for (
    const item of availableItems
  ) {
    if (
      !groups.has(
        item.route.code
      )
    ) {
      groups.set(
        item.route.code,
        {
          route:
            item.route,

          slots:
            []
        }
      );
    }

    groups
      .get(
        item.route.code
      )
      .slots
      .push(
        item
      );
  }

  return [
    ...groups.values()
  ];
}


function buildAvailabilityBody(
  targetDate,
  availableItems
) {
  const routeSections =
    groupAvailabilityByRoute(
      availableItems
    )
      .map(
        group => {
          const slots =
            group.slots
              .map(
                item =>
                  '• ' +
                  item.time +
                  ' — ' +
                  item.seats +
                  ' ' +
                  (
                    item.seats === 1
                      ? 'cupo'
                      : 'cupos'
                  )
              )
              .join('\n');

          return (
            'Ruta ' +
            group.route.code +
            ' — ' +
            group.route.name +
            '\n' +
            slots
          );
        }
      )
      .join('\n\n');

  return (
    'Fecha: ' +
    formatDatePE(
      targetDate
    ) +
    '\n' +
    'Cantidad mínima: ' +
    CONFIG.requiredTickets +
    '\n\n' +
    routeSections
  );
}


function buildAvailabilityMessage(
  targetDate,
  availableItems
) {
  return (
    '🚨 ENTRADAS LIBERADAS PARA MAÑANA\n\n' +
    buildAvailabilityBody(
      targetDate,
      availableItems
    ) +
    '\n\nCompra inmediatamente en:\n' +
    CONFIG.siteUrl +
    '\n\nDetectado: ' +
    getLimaTimestamp()
  );
}


function buildManualSummary(
  targetDate,
  results,
  availableItems
) {
  const processed =
    results.filter(
      result =>
        result.processed
    );

  const errors =
    results.filter(
      result =>
        !result.processed
    );

  const unavailableRoutes =
    results.filter(
      result =>
        result.processed &&
        !result.routeEnabled
    );

  const notes =
    [];

  if (
    unavailableRoutes.length
  ) {
    notes.push(
      'Rutas no habilitadas en el portal: ' +
      unavailableRoutes
        .map(
          item =>
            item.route.code
        )
        .join(', ')
    );
  }

  if (
    errors.length
  ) {
    notes.push(
      'Rutas con error: ' +
      errors
        .map(
          item =>
            item.route.code
        )
        .join(', ')
    );
  }

  let resultText;

  if (
    processed.length === 0
  ) {
    resultText =
      'No fue posible verificar la disponibilidad en ninguna ruta.';

  } else if (
    availableItems.length
  ) {
    resultText =
      'Se encontraron cupos:\n\n' +
      buildAvailabilityBody(
        targetDate,
        availableItems
      );

  } else {
    resultText =
      'No se encontraron rutas con al menos ' +
      CONFIG.requiredTickets +
      ' cupos disponibles.';
  }

  return (
    '🔎 REVISIÓN MANUAL COMPLETADA\n\n' +
    'Fecha vigilada: ' +
    formatDatePE(
      targetDate
    ) +
    '\n' +
    'Rutas procesadas: ' +
    processed.length +
    ' de ' +
    ROUTES.length +
    '\n\n' +
    resultText +
    (
      notes.length
        ? (
          '\n\n' +
          notes.join('\n')
        )
        : ''
    ) +
    '\n\nRevisado: ' +
    getLimaTimestamp()
  );
}


/* ============================================================
 * EJECUCIÓN PRINCIPAL
 * ============================================================
 */

async function main() {
  validateConfiguration();
  ensureDiagnosticDirectory();

  const target =
    getTomorrowInLima();

  const previousState =
    loadState();

  const previousKeys =
    previousState.targetDate ===
    target.iso
      ? new Set(
        previousState.availableKeys
      )
      : new Set();

  console.log(
    'Fecha de mañana en Perú:',
    target.iso
  );

  const browser =
    await chromium.launch({
      headless: true
    });

  const context =
    await browser.newContext({
      locale:
        'es-PE',

      timezoneId:
        CONFIG.timeZone,

      viewport: {
        width:
          1440,

        height:
          1100
      },

      extraHTTPHeaders: {
        'Accept-Language':
          'es-PE,es;q=0.9,en;q=0.8'
      }
    });

  try {
    const results =
      [];

    /*
     * Revisa las rutas una por una para
     * no sobrecargar el portal.
     */
    for (
      const route of ROUTES
    ) {
      const result =
        await checkRoute(
          context,
          route,
          target
        );

      results.push(
        result
      );

      await new Promise(
        resolve =>
          setTimeout(
            resolve,
            500
          )
      );
    }

    const availableItems =
      results
        .flatMap(
          result =>
            result.matchingSlots.map(
              slot => ({
                key:
                  result.route.code +
                  '|' +
                  slot.time,

                route:
                  result.route,

                time:
                  slot.time,

                seats:
                  slot.seats
              })
            )
        )
        .sort(
          (a, b) =>
            a.key.localeCompare(
              b.key
            )
        );

    /*
     * Si una ruta falló, se conserva su estado anterior
     * para evitar falsas alertas repetidas.
     */
    const failedRouteCodes =
      new Set(
        results
          .filter(
            result =>
              !result.processed
          )
          .map(
            result =>
              result.route.code
          )
      );

    const preservedKeys =
      [
        ...previousKeys
      ].filter(
        key => {
          const routeCode =
            key.split('|')[0];

          return failedRouteCodes.has(
            routeCode
          );
        }
      );

    const stateKeys = [
      ...preservedKeys,

      ...availableItems.map(
        item =>
          item.key
      )
    ];

    const newAvailableItems =
      availableItems.filter(
        item =>
          !previousKeys.has(
            item.key
          )
      );

    const processedCount =
      results.filter(
        result =>
          result.processed
      ).length;

    const allRoutesFailed =
      processedCount === 0;

    console.log(
      JSON.stringify(
        {
          targetDate:
            target.iso,

          processedRoutes:
            processedCount,

          availableItems,

          newAvailableItems
        },
        null,
        2
      )
    );

    /*
     * Una ejecución manual siempre envía
     * el resumen completo.
     */
    if (
      CONFIG.notifyStatus
    ) {
      await sendTelegram(
        buildManualSummary(
          target.iso,
          results,
          availableItems
        )
      );

    /*
     * Una ejecución automática solo avisa
     * cuando aparece disponibilidad nueva.
     */
    } else if (
      newAvailableItems.length > 0
    ) {
      await sendTelegram(
        buildAvailabilityMessage(
          target.iso,
          availableItems
        )
      );

      console.log(
        'Alerta de disponibilidad enviada.'
      );

    } else {
      console.log(
        'No existen nuevas disponibilidades.'
      );
    }

    /*
     * En automático, informa una sola vez
     * si fallan las diez rutas.
     */
    if (
      allRoutesFailed &&
      !CONFIG.notifyStatus &&
      !previousState.allRoutesFailed
    ) {
      await sendTelegram(
        '⚠️ EL MONITOR NO PUDO REVISAR TU BOLETO\n\n' +
        'Ninguna ruta pudo procesarse en esta ejecución.\n' +
        'Revisa GitHub Actions y los archivos de diagnóstico.\n\n' +
        'Hora: ' +
        getLimaTimestamp()
      );
    }

    saveState(
      target.iso,
      stateKeys,
      allRoutesFailed
    );

    if (
      allRoutesFailed
    ) {
      process.exitCode =
        1;
    }

  } finally {
    await context.close();
    await browser.close();
  }
}


await main();
