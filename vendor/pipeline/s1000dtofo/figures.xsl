<?xml version="1.0" encoding="UTF-8"?>
<!-- ********************************************************************
     S1000D to XSL-FO: Figures Module
     
     Contains templates for figure and graphic processing.
     ******************************************************************** -->
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0"
  xmlns:fo="http://www.w3.org/1999/XSL/Format">
    <!-- ==================================================================== -->
    <!--                         FIGURE TEMPLATE                               -->
    <!-- ==================================================================== -->
    <!--
      A figure is: its graphic(s), then ONE caption, then the callout legend.

      The figure is deliberately NOT kept together as a whole. Forcing that is
      what makes a figure with several images, or a long callout key, overrun
      the bottom of the page and collide with the footer — there is simply no
      page tall enough. Each image is kept intact individually and the caption
      is tied to the last one; beyond that the figure is allowed to flow.
    -->
    <xsl:template match="figure">
        <fo:block>
            <xsl:call-template name="unique-id-attr"/>
            <xsl:apply-templates select="graphic"/>
            <!-- One caption per FIGURE. It used to be emitted inside the
                 graphic template, which gave a multi-image figure a repeated
                 caption under every single image. -->
            <fo:block font-style="italic" text-align="center"
                      space-before="2mm" space-after="2mm"
                      keep-with-previous.within-page="always">
                <xsl:text>Fig </xsl:text>
                <xsl:apply-templates select="." mode="number"/>
                <xsl:if test="title">
                    <xsl:text>  </xsl:text>
                    <xsl:apply-templates select="." mode="title"/>
                </xsl:if>
            </fo:block>
            <xsl:apply-templates select="legend"/>
        </fo:block>
    </xsl:template>

    <!-- ==================================================================== -->
    <!--                      FIGURE LEGEND (CALLOUT KEY)                      -->
    <!-- ==================================================================== -->
    <!--
      The callout key that pairs each number on the illustration with the part
      it points at, laid out in $figure.legend.cols columns filled
      left-to-right. Without this template the legend's definitionList fell
      through to the generic handler (or nothing at all), so the numbers a
      reader needs to interpret the drawing were missing from the page.
    -->
    <xsl:template match="legend">
        <xsl:variable name="items" select="definitionList/definitionListItem"/>
        <xsl:if test="$items">
            <xsl:variable name="cols" select="number($figure.legend.cols)"/>
            <fo:table table-layout="fixed" width="100%" font-size="{$table-font-size}"
                      space-before="1mm" space-after="3mm">
                <xsl:call-template name="legend-cols">
                    <xsl:with-param name="n" select="$cols"/>
                </xsl:call-template>
                <fo:table-body>
                    <!-- One row per group of $cols items, filled row-major. -->
                    <xsl:for-each select="$items[position() mod $cols = 1 or $cols = 1]">
                        <fo:table-row>
                            <xsl:for-each select=". | following-sibling::definitionListItem[position() &lt; $cols]">
                                <fo:table-cell padding-top="0.6mm" padding-bottom="0.6mm">
                                    <fo:list-block provisional-distance-between-starts="9mm"
                                                   provisional-label-separation="2mm">
                                        <fo:list-item>
                                            <fo:list-item-label end-indent="label-end()">
                                                <fo:block font-weight="bold">
                                                    <xsl:value-of select="normalize-space(listItemTerm)"/>
                                                </fo:block>
                                            </fo:list-item-label>
                                            <fo:list-item-body start-indent="body-start()">
                                                <fo:block>
                                                    <xsl:value-of select="normalize-space(listItemDefinition)"/>
                                                </fo:block>
                                            </fo:list-item-body>
                                        </fo:list-item>
                                    </fo:list-block>
                                </fo:table-cell>
                            </xsl:for-each>
                        </fo:table-row>
                    </xsl:for-each>
                </fo:table-body>
            </fo:table>
        </xsl:if>
        <!-- Any non-list legend content (free text) still renders, so nothing
             an author wrote is silently dropped. -->
        <xsl:apply-templates select="*[not(self::definitionList)]|processing-instruction('page-break')"/>
    </xsl:template>

    <!-- Emit $n equal-width fo:table-columns. -->
    <xsl:template name="legend-cols">
        <xsl:param name="n"/>
        <xsl:if test="$n &gt;= 1">
            <fo:table-column column-width="proportional-column-width(1)"/>
            <xsl:call-template name="legend-cols">
                <xsl:with-param name="n" select="$n - 1"/>
            </xsl:call-template>
        </xsl:if>
    </xsl:template>
    <xsl:template match="figure" mode="number">
        <xsl:choose>
            <!-- JSS format: chapter-based numbering (1-1, 1-2, etc.) -->
            <xsl:when test="contains($document.format, 'JSS')">
                <!-- Chapter number (count description|procedure|faultIsolation|crew up to current chapter) -->
                <xsl:variable name="chapter-number">
                    <xsl:number count="description|procedure|faultIsolation|crew" level="any" from="content"/>
                </xsl:variable>
                <!-- Figure number within chapter -->
                <xsl:variable name="figure-in-chapter">
                    <xsl:number count="figure" level="any" from="description|procedure|faultIsolation|crew"/>
                </xsl:variable>
                <xsl:value-of select="$chapter-number"/>
                <xsl:text>-</xsl:text>
                <xsl:value-of select="$figure-in-chapter"/>
            </xsl:when>
            <!--
              S1000D format. Counted from the whole publication or from the
              data module, per $figure.numbering — and counted here, in the one
              template the caption, the list of figures and the list of
              illustrations all use, so the number a reader looks up is by
              construction the number printed on the page.
            -->
            <xsl:when test="$figure.numbering = 'continuous'">
                <xsl:number count="figure" level="any" from="/"/>
            </xsl:when>
            <xsl:otherwise>
                <xsl:number count="figure" level="any" from="dmodule"/>
            </xsl:otherwise>
        </xsl:choose>
    </xsl:template>
    <xsl:template match="figure" mode="title">
        <xsl:apply-templates select="title" mode="title"/>
    </xsl:template>
    <xsl:template match="figure" mode="label">
        <xsl:text>Fig </xsl:text>
        <xsl:apply-templates select="." mode="number"/>
    </xsl:template>
    <xsl:template match="title" mode="title">
        <xsl:apply-templates/>
    </xsl:template>
    <!-- ==================================================================== -->
    <!--                         GRAPHIC TEMPLATE                              -->
    <!-- ==================================================================== -->
    <!-- The last path segment of a URI — the filename the dimension index is
         keyed by. XSLT 1.0 has no basename(), so recurse on '/'. -->
    <xsl:template name="basename">
        <xsl:param name="p"/>
        <xsl:choose>
            <xsl:when test="contains($p, '/')">
                <xsl:call-template name="basename">
                    <xsl:with-param name="p" select="substring-after($p, '/')"/>
                </xsl:call-template>
            </xsl:when>
            <xsl:otherwise><xsl:value-of select="$p"/></xsl:otherwise>
        </xsl:choose>
    </xsl:template>

    <xsl:template match="graphic">
        <!-- Held in a variable: inside the predicate below the context node is
             the index entry, so @infoEntityIdent would resolve against that. -->
        <xsl:variable name="icn" select="normalize-space(@infoEntityIdent)"/>
        <xsl:variable name="uri" select="unparsed-entity-uri(@infoEntityIdent)"/>
        <!--
          Where the image really is, according to the side-car index the build
          writes from the files actually on disk.

          Matched on the ICN itself (the index carries each file's name without
          its extension), so it finds the image whatever folder it was uploaded
          into and whatever format it is. Both mattered: a newly uploaded ICN
          lands in csdb/ while the guess below assumes Media/, and the guess
          also hardcodes .png — so a new figure pointing at a freshly uploaded
          image rendered as nothing at all, with only a line in the build log
          to say so. <symbol> already resolved this way; <graphic> did not.
        -->
        <xsl:variable name="indexed"
            select="$image.dims/img[@stem = translate($icn, $upper.abc, $lower.abc)]/@src"/>
        <xsl:variable name="src">
            <xsl:choose>
                <!--
                  An explicit @src wins outright. The generated front-matter
                  pages are shared with the JSS engine and address their
                  pictures that way — <graphic src="Media/SystemImage.jpg"/> —
                  having no ICN and no entity. Resolving by ICN regardless
                  produced $graphics.dir + "" + $graphics.ext, i.e.
                  "Media/.png", so the system illustration and any other
                  front-matter picture rendered as nothing at all.
                -->
                <xsl:when test="normalize-space(@src) != ''">
                    <xsl:value-of select="normalize-space(@src)"/>
                </xsl:when>
                <!-- A declared ICN entity is the author's own statement of
                     where the file is, so it still wins over the index. -->
                <xsl:when test="$uri != ''"><xsl:value-of select="$uri"/></xsl:when>
                <xsl:when test="$indexed != ''"><xsl:value-of select="$indexed"/></xsl:when>
                <!-- Neither a declared entity nor a file on disk: keep the old
                     conventional path so the existing "unresolved image"
                     warning still names something recognisable. -->
                <xsl:otherwise>
                    <xsl:value-of select="concat($graphics.dir, $icn, $graphics.ext)"/>
                </xsl:otherwise>
            </xsl:choose>
        </xsl:variable>
        <xsl:variable name="file">
            <xsl:call-template name="basename">
                <xsl:with-param name="p" select="$src"/>
            </xsl:call-template>
        </xsl:variable>
        <!-- Real pixel size, from the side-car index the build writes. Absent
             (unreadable/missing image) we simply fall back to the old
             scale-to-fit behaviour rather than guessing a size. -->
        <xsl:variable name="dim"
            select="$image.dims/img[@name = translate($file, $upper.abc, $lower.abc)]"/>

        <!-- Size caps come from Settings > Figures, chosen by the orientation
             this graphic will actually be laid out in. Previously a single
             global $graphic.max.* applied everywhere, so the landscape and
             A3 caps in Settings had no effect on this engine at all. -->
        <xsl:variable name="orient">
            <xsl:choose>
                <xsl:when test="ancestor::pmEntry[@id='a3-landscape']">a3landscape</xsl:when>
                <!--
                  A foldout-wrapped figure carries no orient="land" of its
                  own — <foldout> is the landscape signal (see descript.xsl's
                  emit-orientation-runs) — so without this the graphic still
                  read as portrait even though it was correctly laid out on
                  the landscape page. It rendered at the PORTRAIT width cap
                  (~170mm) inside a page roughly 287mm wide, leaving the rest
                  of the landscape page blank: the page orientation was
                  right, only the image inside it never found out.
                -->
                <xsl:when test="ancestor::figure[@orient='land'] or ancestor::foldout">landscape</xsl:when>
                <xsl:otherwise>portrait</xsl:otherwise>
            </xsl:choose>
        </xsl:variable>
        <xsl:variable name="capWmm">
            <xsl:choose>
                <xsl:when test="$orient = 'a3landscape'"><xsl:value-of select="$graphic.cap.a3landscape.w"/></xsl:when>
                <xsl:when test="$orient = 'landscape'"><xsl:value-of select="$graphic.cap.landscape.w"/></xsl:when>
                <xsl:otherwise><xsl:value-of select="$graphic.cap.portrait.w"/></xsl:otherwise>
            </xsl:choose>
        </xsl:variable>
        <xsl:variable name="capHmm">
            <xsl:choose>
                <xsl:when test="$orient = 'a3landscape'"><xsl:value-of select="$graphic.cap.a3landscape.h"/></xsl:when>
                <xsl:when test="$orient = 'landscape'"><xsl:value-of select="$graphic.cap.landscape.h"/></xsl:when>
                <xsl:otherwise><xsl:value-of select="$graphic.cap.portrait.h"/></xsl:otherwise>
            </xsl:choose>
        </xsl:variable>

        <!-- keep-together per IMAGE, not per figure: an individual illustration
             should never be split across a page boundary, but a figure holding
             several of them must still be free to flow. -->
        <fo:block text-align="center" padding-top="{$standard-leading}"
                  keep-together.within-page="always">
            <xsl:choose>
                <!-- Author gave an explicit size: honour it exactly. -->
                <xsl:when test="@reproductionWidth or @reproductionHeight or @reproductionScale">
                    <fo:external-graphic src="url('{$src}')" scaling="uniform"
                                         max-height="{concat($capHmm, 'mm')}">
                        <xsl:choose>
                            <xsl:when test="@reproductionWidth">
                                <xsl:attribute name="content-width"><xsl:value-of select="@reproductionWidth"/></xsl:attribute>
                            </xsl:when>
                            <xsl:when test="@reproductionScale">
                                <xsl:attribute name="content-width"><xsl:value-of select="@reproductionScale"/>%</xsl:attribute>
                            </xsl:when>
                        </xsl:choose>
                        <xsl:if test="@reproductionHeight">
                            <xsl:attribute name="content-height"><xsl:value-of select="@reproductionHeight"/></xsl:attribute>
                        </xsl:if>
                    </fo:external-graphic>
                </xsl:when>

                <!--
                  No explicit size, but the real pixel dimensions are known:
                  fit the image's true aspect ratio inside the page caps. The
                  previous behaviour (content-width="scale-to-fit" width="100%")
                  forced every image to the full text width regardless of its
                  actual shape, which blew small images up and pushed tall ones
                  past the bottom of the page.
                -->
                <xsl:when test="$dim">
                    <xsl:variable name="natW" select="number($dim/@w) * 254 div 960"/>
                    <xsl:variable name="natH" select="number($dim/@h) * 254 div 960"/>
                    <xsl:variable name="capW" select="number($capWmm)"/>
                    <xsl:variable name="capH" select="number($capHmm)"/>
                    <!-- Never enlarge past natural size; shrink to whichever
                         cap binds first so the aspect ratio is preserved. -->
                    <xsl:variable name="scale">
                        <xsl:choose>
                            <xsl:when test="$natW &gt; $capW and ($capW div $natW) &lt;= ($capH div $natH)">
                                <xsl:value-of select="$capW div $natW"/>
                            </xsl:when>
                            <xsl:when test="$natH &gt; $capH">
                                <xsl:value-of select="$capH div $natH"/>
                            </xsl:when>
                            <xsl:otherwise>1</xsl:otherwise>
                        </xsl:choose>
                    </xsl:variable>
                    <fo:external-graphic src="url('{$src}')" scaling="uniform"
                                         content-width="{format-number($natW * $scale, '0.##')}mm"
                                         content-height="{format-number($natH * $scale, '0.##')}mm"/>
                </xsl:when>

                <!-- Unknown size: previous behaviour, capped so it cannot
                     overrun the page. -->
                <xsl:otherwise>
                    <fo:external-graphic src="url('{$src}')" scaling="uniform"
                                         content-width="scale-down-to-fit"
                                         content-height="scale-down-to-fit"
                                         width="{concat($capWmm, 'mm')}"
                                         max-height="{concat($capHmm, 'mm')}"/>
                </xsl:otherwise>
            </xsl:choose>
            <!-- ICN display (optional) -->
            <xsl:if test="$show.graphic.icn != 0">
                <fo:block text-align="center" font-size="8pt">
                    <xsl:value-of select="@infoEntityIdent"/>
                </fo:block>
            </xsl:if>
        </fo:block>
    </xsl:template>
    <!-- ==================================================================== -->
    <!--                    MULTIMEDIA TEMPLATE                                -->
    <!-- ==================================================================== -->
    <xsl:template match="multimedia">
        <fo:block text-align="center" padding-top="{$standard-leading}">
            <xsl:apply-templates/>
        </fo:block>
    </xsl:template>
    <xsl:template match="multimediaObject">
        <fo:block>
            <xsl:text>[Multimedia: </xsl:text>
            <xsl:value-of select="@infoEntityIdent"/>
            <xsl:text>]</xsl:text>
        </fo:block>
    </xsl:template>
    <!-- ==================================================================== -->
    <!--                    SYMBOL TEMPLATE                                    -->
    <!-- ==================================================================== -->
    <xsl:template match="symbol">
        <!--
          An outright height override for a caller with a fixed amount of room
          — the page header, whose region cannot grow. Empty everywhere else,
          which leaves the author's own sizing untouched.

          An override rather than an fo:max-height: FOP does not apply
          max-height to an fo:external-graphic that already carries an explicit
          content-height, so the logo kept its authored 20mm and simply spilled
          out of a 16mm header onto the text below.
        -->
        <xsl:param name="force-height"/>
        <!-- Same entity-then-path resolution as <graphic>. Without the
             fallback a symbol whose ICN has no matching unparsed entity
             produced src="" and rendered as nothing at all — silently, even
             when the file was sitting in the CSDB under exactly that ICN
             (a DOCTYPE can easily carry a stale entity name after a data
             module is copied between publications). -->
        <xsl:variable name="icn" select="normalize-space(@infoEntityIdent)"/>
        <xsl:variable name="declared" select="unparsed-entity-uri($icn)"/>
        <!--
          An entity URI is only usable if it names an image FILE.

          "" != '' is not enough of a test. A DOCTYPE copied from a sample
          publication commonly declares the entity with an empty system
          identifier:

              <!ENTITY house-logo SYSTEM "" NDATA anything>

          and an empty system id resolves against the document, so
          unparsed-entity-uri returns the SOURCE DOCUMENT'S OWN NAME —
          non-empty, so it won passed the old test, and then handed FOP an XML
          file to draw as a picture. Requiring an image extension sends that
          case on to the index below, which knows where the file really is.
        -->
        <xsl:variable name="lower-uri" select="translate($declared, $upper.abc, $lower.abc)"/>
        <xsl:variable name="entity-uri">
            <xsl:if test="$declared != ''
                          and (substring($lower-uri, string-length($lower-uri) - 3) = '.png'
                            or substring($lower-uri, string-length($lower-uri) - 3) = '.jpg'
                            or substring($lower-uri, string-length($lower-uri) - 3) = '.gif'
                            or substring($lower-uri, string-length($lower-uri) - 3) = '.svg'
                            or substring($lower-uri, string-length($lower-uri) - 3) = '.tif'
                            or substring($lower-uri, string-length($lower-uri) - 4) = '.jpeg'
                            or substring($lower-uri, string-length($lower-uri) - 4) = '.tiff')">
                <xsl:value-of select="$declared"/>
            </xsl:if>
        </xsl:variable>
        <!-- The side-car index knows where every image actually is, so it
             beats guessing $graphics.dir: ICNs commonly sit beside the data
             modules in the CSDB rather than in the media folder. -->
        <xsl:variable name="indexed"
            select="$image.dims/img[@stem = translate($icn, $upper.abc, $lower.abc)]/@src"/>
        <xsl:variable name="src">
            <xsl:choose>
                <xsl:when test="$entity-uri != ''">
                    <xsl:value-of select="$entity-uri"/>
                </xsl:when>
                <xsl:when test="$indexed != ''">
                    <xsl:value-of select="$indexed"/>
                </xsl:when>
                <xsl:otherwise>
                    <xsl:value-of select="concat($graphics.dir, $icn, $graphics.ext)"/>
                </xsl:otherwise>
            </xsl:choose>
        </xsl:variable>
        <fo:external-graphic src="{$src}"
            scaling="uniform">
            <xsl:choose>
                <!-- The caller's ceiling wins: it knows the space exists. -->
                <xsl:when test="$force-height != ''">
                    <xsl:attribute name="content-height"><xsl:value-of select="$force-height"/></xsl:attribute>
                    <xsl:attribute name="content-width">scale-down-to-fit</xsl:attribute>
                </xsl:when>
                <!-- Explicit height overrides everything -->
                <xsl:when test="@reproductionHeight">
                    <xsl:attribute name="content-height">
                        <xsl:value-of select="@reproductionHeight"/>
                    </xsl:attribute>
                    <xsl:attribute name="content-width">scale-down-to-fit</xsl:attribute>
                </xsl:when>
                <!-- Explicit width -->
                <xsl:when test="@reproductionWidth">
                    <xsl:attribute name="content-width">
                        <xsl:value-of select="@reproductionWidth"/>
                    </xsl:attribute>
                    <xsl:attribute name="content-height">scale-down-to-fit</xsl:attribute>
                </xsl:when>
                <!--
                  reproductionScale: an icon, sized by $symbol.size.

                  Height only, and deliberately no width/height attributes: in
                  XSL-FO those set the VIEWPORT, so the old 60mm x 60mm pair
                  reserved a 60mm-tall square box for every symbol however
                  small it scaled down to be — which is what made a hazard icon
                  occupy most of a table row. With just content-height the
                  viewport shrinks to the scaled image and the row hugs it.

                  (S1000D's reproductionScale is really a percentage of natural
                  size, not a length; reading it as "60mm" was wrong on both
                  counts. Symbols are icons, so a fixed icon height is both
                  simpler and more predictable than scaling each one.)
                -->
                <xsl:when test="@reproductionScale">
                    <xsl:attribute name="content-height"><xsl:value-of select="$symbol.size"/></xsl:attribute>
                    <xsl:attribute name="content-width">scale-down-to-fit</xsl:attribute>
                </xsl:when>
                <!-- No attributes: small inline icon -->
                <xsl:otherwise>
                    <xsl:attribute name="content-height">16pt</xsl:attribute>
                    <xsl:attribute name="content-width">scale-down-to-fit</xsl:attribute>
                </xsl:otherwise>
            </xsl:choose>
        </fo:external-graphic>
    </xsl:template>
    <!-- ==================================================================== -->
    <!--                    HOTSPOT (for interactive graphics)                 -->
    <!-- ==================================================================== -->
    <xsl:template match="hotspot">
        <xsl:if test="@id">
            <fo:inline><xsl:call-template name="unique-id-attr"/></fo:inline>
        </xsl:if>
    </xsl:template>
    <!-- ==================================================================== -->
    <!--                    FOLDOUT                                            -->
    <!-- ==================================================================== -->
    <!--
      <foldout> wraps a figure/figureAlts or a table meant to print as an
      oversized fold-out page. It carries no content of its own - it is
      purely a "this is a fold-out" marker - so rendering it is just
      rendering whatever it wraps. The marker itself is read by
      emit-orientation-runs (descript.xsl), which treats a descendant
      foldout exactly like orient="land": the wrapped figure/table gets its
      own landscape page-sequence, same machinery, same page masters.
    -->
    <xsl:template match="foldout">
        <xsl:apply-templates/>
    </xsl:template>
</xsl:stylesheet>