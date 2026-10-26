<?xml version="1.0" encoding="UTF-8"?>
<!-- ********************************************************************
     JSS to XSL-FO: Page Setup Module

     Three page-sequence families, matching the stencil:
       cover  - classification banner top and bottom, no running head
       prelim - roman page numbers (i, ii, iii ...)
       body   - chapter-relative page numbers (1-1, 3-8 ...)
     ******************************************************************** -->
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0"
  xmlns:fo="http://www.w3.org/1999/XSL/Format">

    <xsl:template name="layout-master-set">
        <fo:layout-master-set>

            <!-- ============ COVER (classification banner only) ============ -->
            <fo:simple-page-master master-name="cover"
              page-width="{$page-width}" page-height="{$page-height}"
              margin-top="{$page-margin-top}" margin-bottom="{$page-margin-bottom}"
              margin-left="{$margin-outer}" margin-right="{$margin-outer}">
                <fo:region-body margin-top="12mm" margin-bottom="12mm"/>
                <fo:region-before region-name="cover-before" extent="10mm" display-align="before"/>
                <fo:region-after region-name="cover-after" extent="10mm" display-align="after"/>
            </fo:simple-page-master>

            <!-- ============ PRELIM (roman numerals) ============ -->
            <fo:simple-page-master master-name="prelim-odd"
              page-width="{$page-width}" page-height="{$page-height}"
              margin-top="{$page-margin-top}" margin-bottom="{$page-margin-bottom}"
              margin-left="{$margin-inner}" margin-right="{$margin-outer}">
                <fo:region-body margin-top="{$body-margin-top}" margin-bottom="{$body-margin-bottom}">
                    <xsl:call-template name="watermark-bg-attrs"/>
                </fo:region-body>
                <fo:region-before region-name="prelim-before-odd" extent="{$region-before-extent}" display-align="before"/>
                <fo:region-after region-name="prelim-after-odd" extent="{$region-after-extent}" display-align="after"/>
            </fo:simple-page-master>

            <fo:simple-page-master master-name="prelim-even"
              page-width="{$page-width}" page-height="{$page-height}"
              margin-top="{$page-margin-top}" margin-bottom="{$page-margin-bottom}"
              margin-left="{$margin-outer}" margin-right="{$margin-inner}">
                <fo:region-body margin-top="{$body-margin-top}" margin-bottom="{$body-margin-bottom}">
                    <xsl:call-template name="watermark-bg-attrs"/>
                </fo:region-body>
                <fo:region-before region-name="prelim-before-even" extent="{$region-before-extent}" display-align="before"/>
                <fo:region-after region-name="prelim-after-even" extent="{$region-after-extent}" display-align="after"/>
            </fo:simple-page-master>

            <!-- Used when the front matter is forced to end on an even page
                 (force-page-count="end-on-even" in prelim-page-sequence) so
                 that Chapter 1 — which always opens on its own local page 1,
                 unconditionally styled as the odd/right-hand master — actually
                 lands on a true odd page of the finished PDF instead of
                 whatever parity the front matter's page count happened to
                 leave behind. -->
            <!-- Dedicated, undeclared flow names — see body-blank's own note
                 further down for why: an intentionally-blank page should
                 carry no running head/foot, and reusing prelim-before-even/
                 prelim-after-even (as this used to) pulled the ordinary
                 running furniture in anyway. -->
            <fo:simple-page-master master-name="prelim-blank"
              page-width="{$page-width}" page-height="{$page-height}"
              margin-top="{$page-margin-top}" margin-bottom="{$page-margin-bottom}"
              margin-left="{$margin-outer}" margin-right="{$margin-inner}">
                <fo:region-body region-name="prelim-blank-body" margin-top="{$body-margin-top}" margin-bottom="{$body-margin-bottom}" background-image="url('{$blank.page.svg}')" background-repeat="no-repeat" background-position-horizontal="center" background-position-vertical="center"/>
                <fo:region-before region-name="prelim-before-blank" extent="{$region-before-extent}" display-align="before"/>
                <fo:region-after region-name="prelim-after-blank" extent="{$region-after-extent}" display-align="after"/>
            </fo:simple-page-master>

            <fo:page-sequence-master master-name="prelim">
                <fo:repeatable-page-master-alternatives>
                    <fo:conditional-page-master-reference master-reference="prelim-blank" blank-or-not-blank="blank"/>
                    <fo:conditional-page-master-reference master-reference="prelim-odd" odd-or-even="odd"/>
                    <fo:conditional-page-master-reference master-reference="prelim-even" odd-or-even="even"/>
                </fo:repeatable-page-master-alternatives>
            </fo:page-sequence-master>

            <!-- ============ BODY (chapter-relative numbers) ============ -->
            <fo:simple-page-master master-name="body-odd"
              page-width="{$page-width}" page-height="{$page-height}"
              margin-top="{$page-margin-top}" margin-bottom="{$page-margin-bottom}"
              margin-left="{$margin-inner}" margin-right="{$margin-outer}">
                <fo:region-body margin-top="{$body-margin-top}" margin-bottom="{$body-margin-bottom}">
                    <xsl:call-template name="watermark-bg-attrs"/>
                </fo:region-body>
                <fo:region-before region-name="body-before-odd" extent="{$region-before-extent}" display-align="before"/>
                <fo:region-after region-name="body-after-odd" extent="{$region-after-extent}" display-align="after"/>
            </fo:simple-page-master>

            <fo:simple-page-master master-name="body-even"
              page-width="{$page-width}" page-height="{$page-height}"
              margin-top="{$page-margin-top}" margin-bottom="{$page-margin-bottom}"
              margin-left="{$margin-outer}" margin-right="{$margin-inner}">
                <fo:region-body margin-top="{$body-margin-top}" margin-bottom="{$body-margin-bottom}">
                    <xsl:call-template name="watermark-bg-attrs"/>
                </fo:region-body>
                <fo:region-before region-name="body-before-even" extent="{$region-before-extent}" display-align="before"/>
                <fo:region-after region-name="body-after-even" extent="{$region-after-extent}" display-align="after"/>
            </fo:simple-page-master>

            <!-- Used only when a chapter's own page-sequence is forced to end
                 on an even page (force-page-count="end-on-even" in
                 body-page-sequence), so the NEXT chapter can open on an odd
                 (right-hand) page. region-before/-after use their OWN flow
                 names, deliberately left without any fo:static-content
                 declared for them anywhere — an undeclared flow renders as
                 nothing, which is exactly right for a page whose only content
                 is the "intentionally blank" legend. Reusing body-before-even/
                 body-after-even here, as this used to, pulled in the ordinary
                 running head/foot (publication name, folio, classification)
                 onto a page meant to carry none of that — the direct S1000D
                 engine never had this bug because its own blank masters
                 already used dedicated, empty flow names. -->
            <fo:simple-page-master master-name="body-blank"
              page-width="{$page-width}" page-height="{$page-height}"
              margin-top="{$page-margin-top}" margin-bottom="{$page-margin-bottom}"
              margin-left="{$margin-outer}" margin-right="{$margin-inner}">
                <fo:region-body region-name="body-blank-body" margin-top="{$body-margin-top}" margin-bottom="{$body-margin-bottom}" background-image="url('{$blank.page.svg}')" background-repeat="no-repeat" background-position-horizontal="center" background-position-vertical="center"/>
                <fo:region-before region-name="body-before-blank" extent="{$region-before-extent}" display-align="before"/>
                <fo:region-after region-name="body-after-blank" extent="{$region-after-extent}" display-align="after"/>
            </fo:simple-page-master>

            <fo:page-sequence-master master-name="bodypages">
                <fo:repeatable-page-master-alternatives>
                    <fo:conditional-page-master-reference master-reference="body-blank" blank-or-not-blank="blank"/>
                    <fo:conditional-page-master-reference master-reference="body-odd" odd-or-even="odd"/>
                    <fo:conditional-page-master-reference master-reference="body-even" odd-or-even="even"/>
                </fo:repeatable-page-master-alternatives>
            </fo:page-sequence-master>

            <!-- ============ BODY LANDSCAPE (wide tables / figures) ============ -->
            <!-- Width and height swapped; the inner margin still mirrors so the
                 binding edge stays consistent with the portrait pages. -->
            <fo:simple-page-master master-name="body-landscape-odd"
              page-width="{$page-height}" page-height="{$page-width}"
              margin-top="{$page-margin-top}" margin-bottom="{$page-margin-bottom}"
              margin-left="{$margin-inner}" margin-right="{$margin-outer}">
                <fo:region-body margin-top="{$body-margin-top}" margin-bottom="{$body-margin-bottom}">
                    <xsl:call-template name="watermark-bg-attrs"/>
                </fo:region-body>
                <fo:region-before region-name="body-before-odd" extent="{$region-before-extent}" display-align="before"/>
                <fo:region-after region-name="body-after-odd" extent="{$region-after-extent}" display-align="after"/>
            </fo:simple-page-master>

            <fo:simple-page-master master-name="body-landscape-even"
              page-width="{$page-height}" page-height="{$page-width}"
              margin-top="{$page-margin-top}" margin-bottom="{$page-margin-bottom}"
              margin-left="{$margin-outer}" margin-right="{$margin-inner}">
                <fo:region-body margin-top="{$body-margin-top}" margin-bottom="{$body-margin-bottom}">
                    <xsl:call-template name="watermark-bg-attrs"/>
                </fo:region-body>
                <fo:region-before region-name="body-before-even" extent="{$region-before-extent}" display-align="before"/>
                <fo:region-after region-name="body-after-even" extent="{$region-after-extent}" display-align="after"/>
            </fo:simple-page-master>

            <!-- Blank-verso equivalent for a chapter that ends mid-landscape-run.
                 Same dedicated, undeclared flow names as body-blank above. -->
            <fo:simple-page-master master-name="body-landscape-blank"
              page-width="{$page-height}" page-height="{$page-width}"
              margin-top="{$page-margin-top}" margin-bottom="{$page-margin-bottom}"
              margin-left="{$margin-outer}" margin-right="{$margin-inner}">
                <fo:region-body region-name="body-blank-body" margin-top="{$body-margin-top}" margin-bottom="{$body-margin-bottom}" background-image="url('{$blank.page.svg}')" background-repeat="no-repeat" background-position-horizontal="center" background-position-vertical="center"/>
                <fo:region-before region-name="body-before-blank" extent="{$region-before-extent}" display-align="before"/>
                <fo:region-after region-name="body-after-blank" extent="{$region-after-extent}" display-align="after"/>
            </fo:simple-page-master>

            <fo:page-sequence-master master-name="bodypages-landscape">
                <fo:repeatable-page-master-alternatives>
                    <fo:conditional-page-master-reference master-reference="body-landscape-blank" blank-or-not-blank="blank"/>
                    <fo:conditional-page-master-reference master-reference="body-landscape-odd" odd-or-even="odd"/>
                    <fo:conditional-page-master-reference master-reference="body-landscape-even" odd-or-even="even"/>
                </fo:repeatable-page-master-alternatives>
            </fo:page-sequence-master>

            <!-- ============ BODY A3 LANDSCAPE (very wide tables) ============ -->
            <fo:simple-page-master master-name="body-a3-landscape"
              page-width="420mm" page-height="297mm"
              margin-top="{$page-margin-top}" margin-bottom="{$page-margin-bottom}"
              margin-left="{$margin-inner}" margin-right="{$margin-outer}">
                <fo:region-body margin-top="{$body-margin-top}" margin-bottom="{$body-margin-bottom}">
                    <xsl:call-template name="watermark-bg-attrs"/>
                </fo:region-body>
                <fo:region-before region-name="body-before-odd" extent="{$region-before-extent}" display-align="before"/>
                <fo:region-after region-name="body-after-odd" extent="{$region-after-extent}" display-align="after"/>
            </fo:simple-page-master>

            <!--
              Blank-verso equivalent for a chapter that ends mid-A3-run.

              Without this the sequence had a single unconditional master, so a
              forced blank page was laid out on body-a3-landscape: running head
              and folio, and no "intentionally left blank" legend, because that
              legend only ever comes from the blank masters' region-body
              background. That is precisely how an A3 chapter ended with a
              silent, unmarked blank page.
            -->
            <fo:simple-page-master master-name="body-a3-landscape-blank"
              page-width="420mm" page-height="297mm"
              margin-top="{$page-margin-top}" margin-bottom="{$page-margin-bottom}"
              margin-left="{$margin-outer}" margin-right="{$margin-inner}">
                <fo:region-body region-name="body-blank-body" margin-top="{$body-margin-top}" margin-bottom="{$body-margin-bottom}" background-image="url('{$blank.page.svg}')" background-repeat="no-repeat" background-position-horizontal="center" background-position-vertical="center"/>
                <fo:region-before region-name="body-before-blank" extent="{$region-before-extent}" display-align="before"/>
                <fo:region-after region-name="body-after-blank" extent="{$region-after-extent}" display-align="after"/>
            </fo:simple-page-master>

            <fo:page-sequence-master master-name="bodypages-a3-landscape">
                <fo:repeatable-page-master-alternatives>
                    <fo:conditional-page-master-reference master-reference="body-a3-landscape-blank" blank-or-not-blank="blank"/>
                    <fo:conditional-page-master-reference master-reference="body-a3-landscape"/>
                </fo:repeatable-page-master-alternatives>
            </fo:page-sequence-master>

        </fo:layout-master-set>
    </xsl:template>

    <!-- Background watermark, applied to every non-cover region-body -->
    <xsl:template name="watermark-bg-attrs">
        <xsl:if test="$watermark.image.uri != ''">
            <xsl:attribute name="background-image">
                <xsl:text>url('</xsl:text>
                <xsl:value-of select="$watermark.image.uri"/>
                <xsl:text>')</xsl:text>
            </xsl:attribute>
            <xsl:attribute name="background-repeat"><xsl:value-of select="$watermark.repeat"/></xsl:attribute>
            <xsl:attribute name="background-position-horizontal">center</xsl:attribute>
            <xsl:attribute name="background-position-vertical">center</xsl:attribute>
        </xsl:if>
    </xsl:template>

    <!-- ==================================================================== -->
    <!--  Named page-sequence wrappers                                        -->
    <!-- ==================================================================== -->

    <!-- Cover page: classification banner, no header rule, no folio -->
    <xsl:template name="cover-page-sequence">
        <xsl:param name="content"/>
        <fo:page-sequence master-reference="cover" force-page-count="no-force">
            <fo:static-content flow-name="cover-before">
                <xsl:call-template name="classification-banner"/>
            </fo:static-content>
            <fo:static-content flow-name="cover-after">
                <xsl:call-template name="classification-banner"/>
            </fo:static-content>
            <fo:flow flow-name="xsl-region-body">
                <xsl:copy-of select="$content"/>
            </fo:flow>
        </fo:page-sequence>
    </xsl:template>

    <!--
      One prelim "part" (proprietary, foreword, record of changes, ...) per
      call, each its own page-sequence so it can be individually forced to
      open on an odd (right-hand) page and end on an even one — the same
      right-hand-opening convention as chapters, applied to the front matter.
      Roman numbering stays continuous across parts: only the very first part
      resets to page 1; every later part continues via initial-page-number
      "auto", which correctly lands on an odd page because the previous part's
      own end-on-even always finished on an even one.
    -->
    <xsl:template name="prelim-part-sequence">
        <xsl:param name="content"/>
        <!-- '1' only for the opening part (proprietary); every later part
             carries on the roman folio instead of restarting it. -->
        <xsl:param name="first">0</xsl:param>
        <xsl:if test="normalize-space(string($content)) != ''">
            <fo:page-sequence master-reference="prelim" format="i">
                <xsl:attribute name="initial-page-number">
                    <xsl:choose>
                        <xsl:when test="$first = '1'">1</xsl:when>
                        <xsl:otherwise>auto</xsl:otherwise>
                    </xsl:choose>
                </xsl:attribute>
                <xsl:attribute name="force-page-count">
                    <xsl:choose>
                        <xsl:when test="$blank.versos = '1'">end-on-even</xsl:when>
                        <xsl:otherwise>no-force</xsl:otherwise>
                    </xsl:choose>
                </xsl:attribute>
                <fo:static-content flow-name="prelim-before-odd">
                    <xsl:call-template name="running-head"/>
                </fo:static-content>
                <fo:static-content flow-name="prelim-before-even">
                    <xsl:call-template name="running-head">
                        <xsl:with-param name="align">left</xsl:with-param>
                    </xsl:call-template>
                </fo:static-content>
                <fo:static-content flow-name="prelim-after-odd">
                    <xsl:call-template name="running-foot">
                        <xsl:with-param name="align">right</xsl:with-param>
                    </xsl:call-template>
                </fo:static-content>
                <fo:static-content flow-name="prelim-after-even">
                    <xsl:call-template name="running-foot">
                        <xsl:with-param name="align">left</xsl:with-param>
                    </xsl:call-template>
                </fo:static-content>
                <!-- Note: no static-content for prelim-blank-body — the XSL-FO
                     spec forbids static-content targeting region-body, so the
                     "intentionally left blank" text there comes from a
                     background-image on that region instead (see the
                     prelim-blank simple-page-master above). -->
                <fo:flow flow-name="xsl-region-body" line-height="{$line-height}">
                    <xsl:copy-of select="$content"/>
                </fo:flow>
            </fo:page-sequence>
        </xsl:if>
    </xsl:template>

    <!--
      Body pages. Each chapter is its own page-sequence restarting at 1, and
      the folio is rendered as "<chapter>-<page>" (1-1, 1-2, 3-8 ...). This is
      the only way to get chapter-relative folios in XSL-FO, since fo:page-number
      can not be offset per chapter.
    -->
    <xsl:template name="body-page-sequence">
        <xsl:param name="content"/>
        <xsl:param name="chapter-number"/>
        <!-- '', 'landscape' (A4 rotated) or 'a3-landscape' -->
        <xsl:param name="orientation"/>
        <!-- '1' for a chapter's opening sequence, which restarts the folio at
             1; '0' for the continuation sequences created by an orientation
             change part-way through, which must carry on from the previous
             page so the chapter numbers stay unbroken. -->
        <xsl:param name="first">1</xsl:param>
        <!-- '1' for the chapter's LAST page-sequence (the common case: a
             chapter with a single orientation has exactly one sequence, which
             is both first and last), so a later chapter always opens on an
             odd (right-hand) page. Also '1' at either edge of a landscape
             run (see emit-orientation-runs in body.xsl) — a landscape run is
             a physically distinct print unit, and leaving it an odd number
             of pages runs everything after it one page out of step with the
             rest of the book. '0' everywhere else: padding an ORDINARY
             mid-chapter orientation split too would scatter spurious blank
             pages through the middle of a chapter for no print reason. -->
        <xsl:param name="last">1</xsl:param>
        <xsl:variable name="master">
            <xsl:choose>
                <xsl:when test="$orientation = 'a3-landscape'">bodypages-a3-landscape</xsl:when>
                <xsl:when test="$orientation = 'landscape'">bodypages-landscape</xsl:when>
                <xsl:otherwise>bodypages</xsl:otherwise>
            </xsl:choose>
        </xsl:variable>
        <!--
          The page this sequence is actually laid out on, for running-foot's
          side notes (side.note.text / "Produced by"): body-landscape-* swaps
          $page-width and $page-height on its own simple-page-master, and
          body-a3-landscape is a fixed 420x297 regardless of either parameter
          — see the identical note on this in the S1000D engine's
          pagesetup.xsl. Passed down rather than read directly by
          side-notes/side-note-line, because this is the one place that
          already knows which of the three orientations is in play; nothing
          below it does.
        -->
        <xsl:variable name="page-h">
            <xsl:choose>
                <xsl:when test="$orientation = 'a3-landscape'">297mm</xsl:when>
                <xsl:when test="$orientation = 'landscape'"><xsl:value-of select="$page-width"/></xsl:when>
                <xsl:otherwise><xsl:value-of select="$page-height"/></xsl:otherwise>
            </xsl:choose>
        </xsl:variable>
        <xsl:variable name="page-w">
            <xsl:choose>
                <xsl:when test="$orientation = 'a3-landscape'">420mm</xsl:when>
                <xsl:when test="$orientation = 'landscape'"><xsl:value-of select="$page-height"/></xsl:when>
                <xsl:otherwise><xsl:value-of select="$page-width"/></xsl:otherwise>
            </xsl:choose>
        </xsl:variable>
        <!--
          end-on-even, on the chapter's closing sequence, pads with exactly one
          extra page (styled via the "*-blank" masters' blank-or-not-blank
          condition, which carries the "intentionally left blank" legend) when
          the chapter would otherwise end on an odd page, so the next chapter's
          own initial-page-number="1" always lands on the odd/body-odd
          "right-hand" master. If the chapter already ends even, no page is
          added.

          This applies whatever the closing sequence's orientation, A3
          included. A3 landscape used to be exempted on the grounds that its
          page-sequence-master has no odd/even alternation — but that is about
          which master a page gets, not about how many pages the chapter has.
          A chapter ending on a right-hand A3 page still leaves the next
          chapter opening on a left-hand one, and still owes the reader a page
          marked as deliberately empty.
        -->
        <fo:page-sequence master-reference="{$master}" format="1">
            <xsl:attribute name="force-page-count">
                <xsl:choose>
                    <xsl:when test="$last = '1' and $blank.versos = '1'">end-on-even</xsl:when>
                    <xsl:otherwise>no-force</xsl:otherwise>
                </xsl:choose>
            </xsl:attribute>
            <xsl:attribute name="initial-page-number">
                <xsl:choose>
                    <xsl:when test="$first = '1'">1</xsl:when>
                    <xsl:otherwise>auto</xsl:otherwise>
                </xsl:choose>
            </xsl:attribute>
            <fo:static-content flow-name="body-before-odd">
                <xsl:call-template name="running-head">
                    <xsl:with-param name="classification-color">black</xsl:with-param>
                </xsl:call-template>
            </fo:static-content>
            <fo:static-content flow-name="body-before-even">
                <xsl:call-template name="running-head">
                    <xsl:with-param name="align">left</xsl:with-param>
                    <xsl:with-param name="classification-color">black</xsl:with-param>
                </xsl:call-template>
            </fo:static-content>
            <fo:static-content flow-name="body-after-odd">
                <xsl:call-template name="running-foot">
                    <xsl:with-param name="align">right</xsl:with-param>
                    <xsl:with-param name="chapter-number" select="$chapter-number"/>
                    <xsl:with-param name="page-h" select="$page-h"/>
                    <xsl:with-param name="page-w" select="$page-w"/>
                    <xsl:with-param name="classification-color">black</xsl:with-param>
                </xsl:call-template>
            </fo:static-content>
            <fo:static-content flow-name="body-after-even">
                <xsl:call-template name="running-foot">
                    <xsl:with-param name="align">left</xsl:with-param>
                    <xsl:with-param name="chapter-number" select="$chapter-number"/>
                    <xsl:with-param name="page-h" select="$page-h"/>
                    <xsl:with-param name="page-w" select="$page-w"/>
                    <xsl:with-param name="classification-color">black</xsl:with-param>
                </xsl:call-template>
            </fo:static-content>
            <!-- No static-content for body-blank-body — see the equivalent
                 note in prelim-page-sequence; the legend comes from the
                 body-blank master's region-body background-image instead. -->
            <fo:flow flow-name="xsl-region-body" line-height="{$line-height}">
                <xsl:copy-of select="$content"/>
            </fo:flow>
        </fo:page-sequence>
    </xsl:template>

</xsl:stylesheet>
